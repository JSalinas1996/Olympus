#import "CycleCoordinator.h"
#import "AIApplication.h"
#import "FileCycle.h"

static NSString * const ClaudeBundle = @"com.anthropic.claudefordesktop";
static NSString * const ChatGPTBundle = @"com.openai.codex";

static NSError *CycleError(NSInteger code, NSString *message) {
    return [NSError errorWithDomain:@"OlympusCycle" code:code userInfo:@{NSLocalizedDescriptionKey: message}];
}

NSNumber *OlympusScoreFromEvaluation(NSString *evaluation) {
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"calificaci[oó]n\\s*:\\s*(10|[0-9](?:[.,][0-9]+)?)\\s*(?:/|sobre)\\s*10" options:NSRegularExpressionCaseInsensitive error:nil];
    NSTextCheckingResult *match = [regex matchesInString:evaluation options:0 range:NSMakeRange(0, evaluation.length)].lastObject;
    if (!match || [match rangeAtIndex:1].location == NSNotFound) return nil;
    NSString *value = [[evaluation substringWithRange:[match rangeAtIndex:1]] stringByReplacingOccurrencesOfString:@"," withString:@"."];
    return @(value.doubleValue);
}

static BOOL Cancelled(OlympusCancellationCheck cancelled, NSError **error) {
    if (!cancelled || !cancelled()) return NO;
    if (error) *error = CycleError(9, @"Ciclo cancelado. No se publicó ningún archivo.");
    return YES;
}

static NSString *StrictFileInstruction(NSString *extension, NSUInteger round) {
    NSString *kind = [extension isEqualToString:@"xlsx"] ? @"una planilla Excel" : @"un documento Word";
    return [NSString stringWithFormat:@"\n\nINSTRUCCIÓN DE ENTREGA DE OLYMPUS — RONDA %lu:\nGenerá %@ completa en formato .%@. Tu respuesta debe incluir exactamente un archivo adjunto .%@ listo para descargar. No sustituyas el archivo por una explicación en texto. Verificá que el archivo abra correctamente, contenga todo el desarrollo y conserve ese formato durante las revisiones.", (unsigned long)round, kind, extension, extension];
}

NSDictionary *OlympusRunFileCycle(NSDictionary *payload, OlympusProgressHandler progress, OlympusCancellationCheck cancelled, NSError **error) {
    NSString *prompt = [payload[@"prompt"] isKindOfClass:NSString.class] ? payload[@"prompt"] : @"";
    NSString *professorPrompt = [payload[@"professorPrompt"] isKindOfClass:NSString.class] ? payload[@"professorPrompt"] : @"";
    NSString *reviewContext = [payload[@"reviewContext"] isKindOfClass:NSString.class] ? payload[@"reviewContext"] : @"";
    NSString *extension = [[payload[@"format"] isKindOfClass:NSString.class] ? payload[@"format"] : @"docx" lowercaseString];
    NSUInteger maxRounds = MIN(MAX([payload[@"maxRounds"] unsignedIntegerValue], (NSUInteger)1), (NSUInteger)5);
    if (![@[@"docx", @"xlsx"] containsObject:extension]) { if (error) *error = CycleError(1, @"Formato de entrega inválido."); return nil; }
    if (!prompt.length || !professorPrompt.length) { if (error) *error = CycleError(2, @"Faltan los prompts de Claude o ChatGPT."); return nil; }
    if (OlympusEditableControlCount(ClaudeBundle) == 0 || OlympusEditableControlCount(ChatGPTBundle) == 0) { if (error) *error = CycleError(3, @"Claude o ChatGPT no exponen un cuadro de mensaje. Abrí ambas aplicaciones e iniciá sesión."); return nil; }

    NSString *runDirectory = OlympusBeginRun(error); if (!runDirectory) return nil;
    NSURL *currentFile = nil; NSString *evaluation = @""; NSNumber *score = nil; BOOL chatStarted = NO;
    @try {
        NSString *claudePrompt = [prompt stringByAppendingString:StrictFileInstruction(extension, 1)];
        for (NSUInteger round = 1; round <= maxRounds; round++) {
            if (Cancelled(cancelled, error)) { OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": round == 1 ? @"desarrollando" : @"revisando", @"round": @(round), @"status": round == 1 ? @"Claude está desarrollando el archivo…" : @"Claude está aplicando la corrección al archivo…" });
            NSDictionary *downloadSnapshot = OlympusSnapshotDownloads();
            NSUInteger previousButtons = round == 1 ? 0 : OlympusDownloadButtonCount(ClaudeBundle, extension);
            NSError *stepError = nil;
            BOOL sent = round == 1 ? OlympusSendPromptInNewChat(ClaudeBundle, claudePrompt, &stepError) : OlympusSendPromptInActiveChat(ClaudeBundle, claudePrompt, &stepError);
            if (!sent) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            if (!OlympusWaitAndPressNewDownload(ClaudeBundle, extension, previousButtons, 480, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            if (Cancelled(cancelled, error)) { OlympusCleanRun(runDirectory); return nil; }
            NSURL *download = OlympusWaitForNewOfficeFile(downloadSnapshot, extension, 120, &stepError);
            if (!download) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            currentFile = OlympusCopyVersionToRun(download, runDirectory, round, &stepError);
            if (!currentFile) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:currentFile.path error:nil];
            if ([attributes fileSize] > 40 * 1024 * 1024) { if (error) *error = CycleError(4, @"El archivo generado supera los 40 MB."); OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": @"archivo recibido", @"round": @(round), @"fileName": download.lastPathComponent, @"status": @"Olympus recibió el archivo y está extrayendo su contenido…" });
            NSString *fileText = OlympusExtractOfficeFile(currentFile, &stepError);
            if (!fileText) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }

            NSString *marker = [NSString stringWithFormat:@"OLYMPUS_EVALUACION_RONDA_%lu_%@", (unsigned long)round, NSUUID.UUID.UUIDString];
            NSString *evaluationPrompt = [NSString stringWithFormat:@"%@\n\n%@\n\nActuá como catedrático y corregí esta entrega sobre 10 según las consignas, la rúbrica y el material. Verificá datos, cálculos, afirmaciones y citas. No inventes fuentes. Enumerá todos los cambios concretos necesarios. Cerrá obligatoriamente con una línea independiente de formato exacto CALIFICACIÓN: X/10.\n\nCONTEXTO ACADÉMICO DEL TP:\n%@\n\nCONTENIDO EXTRAÍDO DEL ARCHIVO .%@ DE CLAUDE:\n%@", marker, professorPrompt, reviewContext, extension, fileText];
            progress(@{ @"stage": @"corrigiendo", @"round": @(round), @"fileName": download.lastPathComponent, @"status": @"ChatGPT está corrigiendo el archivo como catedrático…" });
            BOOL evaluationSent = chatStarted ? OlympusSendPromptInActiveChat(ChatGPTBundle, evaluationPrompt, &stepError) : OlympusSendPromptInNewChat(ChatGPTBundle, evaluationPrompt, &stepError);
            if (!evaluationSent) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            chatStarted = YES;
            evaluation = OlympusWaitForScoredResponse(ChatGPTBundle, evaluationPrompt, 480, &stepError);
            if (!evaluation) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            score = OlympusScoreFromEvaluation(evaluation);
            if (!score) { if (error) *error = CycleError(5, @"No pude reconocer la calificación final de ChatGPT."); OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": score.doubleValue == 10 ? @"aprobado" : @"corrección recibida", @"round": @(round), @"fileName": download.lastPathComponent, @"evaluation": evaluation, @"score": score, @"status": score.doubleValue == 10 ? @"ChatGPT aprobó el archivo con 10/10." : @"ChatGPT pidió cambios; Olympus volverá a Claude." });
            if (score.doubleValue == 10) {
                NSData *bytes = [NSData dataWithContentsOfURL:currentFile options:NSDataReadingMappedIfSafe error:&stepError];
                if (!bytes) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
                NSString *mime = [extension isEqualToString:@"xlsx"] ? @"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : @"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                return @{ @"approved": @YES, @"rounds": @(round), @"fileName": download.lastPathComponent, @"mimeType": mime, @"fileBase64": [bytes base64EncodedStringWithOptions:0], @"evaluation": evaluation, @"score": @10, @"runDirectory": runDirectory };
            }
            if (round < maxRounds) claudePrompt = [NSString stringWithFormat:@"Aplicá todas las correcciones del catedrático al archivo de la ronda anterior y generá una versión completa que lo reemplace. Conservá únicamente datos, cálculos, normas y citas verificables.\n\nCORRECCIÓN COMPLETA DE CHATGPT:\n%@%@", evaluation, StrictFileInstruction(extension, round + 1)];
        }
        OlympusCleanRun(runDirectory);
        return @{ @"approved": @NO, @"rounds": @(maxRounds), @"fileName": currentFile.lastPathComponent ?: @"", @"evaluation": evaluation, @"score": score ?: @0, @"status": @"Se alcanzaron tres rondas sin obtener 10/10. No se publicó ningún archivo. Podés agregar una indicación y volver a iniciar." };
    } @catch (NSException *exception) {
        OlympusCleanRun(runDirectory); if (error) *error = CycleError(8, exception.reason ?: @"El ciclo nativo falló."); return nil;
    }
}
