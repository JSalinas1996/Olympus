#import "CycleCoordinator.h"
#import "AIApplication.h"
#import "FileCycle.h"
#import "AIModelController.h"

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

NSArray<NSString *> *OlympusValidatedFormats(id rawFormats, NSError **error) {
    if (![rawFormats isKindOfClass:NSArray.class]) {
        if (error) *error = CycleError(1, @"Seleccioná Word, Excel o ambos formatos.");
        return nil;
    }
    NSMutableSet<NSString *> *requested = [NSMutableSet set];
    for (id value in (NSArray *)rawFormats) {
        if (![value isKindOfClass:NSString.class] || ![@[@"docx", @"xlsx"] containsObject:[value lowercaseString]]) {
            if (error) *error = CycleError(1, @"Formato de entrega inválido. Olympus admite Word y Excel.");
            return nil;
        }
        [requested addObject:[value lowercaseString]];
    }
    NSMutableArray<NSString *> *formats = [NSMutableArray array];
    for (NSString *format in @[@"docx", @"xlsx"]) if ([requested containsObject:format]) [formats addObject:format];
    if (!formats.count) {
        if (error) *error = CycleError(1, @"Seleccioná por lo menos un formato de entrega.");
        return nil;
    }
    return formats;
}

static BOOL Cancelled(OlympusCancellationCheck cancelled, NSError **error) {
    if (!cancelled || !cancelled()) return NO;
    if (error) *error = CycleError(9, @"Ciclo cancelado. No se publicó ningún archivo.");
    return YES;
}

static NSString *FormatName(NSString *extension) {
    return [extension isEqualToString:@"xlsx"] ? @"Excel (.xlsx)" : @"Word (.docx)";
}

static NSString *JoinedFileNames(NSArray<NSDictionary *> *files) {
    NSMutableArray<NSString *> *names = [NSMutableArray array];
    for (NSDictionary *file in files) if ([file[@"fileName"] isKindOfClass:NSString.class]) [names addObject:file[@"fileName"]];
    return [names componentsJoinedByString:@", "];
}

static NSString *StrictFileInstruction(NSArray<NSString *> *formats, NSUInteger round) {
    NSMutableArray<NSString *> *requirements = [NSMutableArray array];
    for (NSString *format in formats) [requirements addObject:[NSString stringWithFormat:@"exactamente un archivo %@", FormatName(format)]];
    NSString *list = [requirements componentsJoinedByString:formats.count > 1 ? @" y " : @""];
    NSString *opening = formats.count > 1 ? @"Generá los archivos solicitados, completos y listos para descargar. Deben constituir juntos una única entrega coherente y cubrir todo lo pedido por el docente." : @"Generá el archivo solicitado, completo y listo para descargar. Debe cubrir todo lo pedido por el docente.";
    return [NSString stringWithFormat:@"\n\nINSTRUCCIÓN DE ENTREGA DE OLYMPUS — RONDA %lu:\n%@ Tu respuesta debe incluir %@, sin archivos adicionales. No sustituyas ningún archivo por una explicación en texto. Verificá que cada archivo abra correctamente y conserve su formato durante las revisiones.", (unsigned long)round, opening, list];
}

static NSDictionary *PublicFile(NSURL *currentFile, NSURL *download, NSString *extension, NSError **error) {
    NSData *bytes = [NSData dataWithContentsOfURL:currentFile options:NSDataReadingMappedIfSafe error:error];
    if (!bytes) return nil;
    NSString *mime = [extension isEqualToString:@"xlsx"] ? @"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : @"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return @{ @"fileName": download.lastPathComponent, @"mimeType": mime, @"fileBase64": [bytes base64EncodedStringWithOptions:0] };
}

NSDictionary *OlympusRunFileCycle(NSDictionary *payload, OlympusProgressHandler progress, OlympusCancellationCheck cancelled, NSError **error) {
    NSString *prompt = [payload[@"prompt"] isKindOfClass:NSString.class] ? payload[@"prompt"] : @"";
    NSString *professorPrompt = [payload[@"professorPrompt"] isKindOfClass:NSString.class] ? payload[@"professorPrompt"] : @"";
    NSString *reviewContext = [payload[@"reviewContext"] isKindOfClass:NSString.class] ? payload[@"reviewContext"] : @"";
    NSDictionary *claudeSelection = [payload[@"claudeModel"] isKindOfClass:NSDictionary.class] ? payload[@"claudeModel"] : @{};
    NSDictionary *chatGPTSelection = [payload[@"chatgptModel"] isKindOfClass:NSDictionary.class] ? payload[@"chatgptModel"] : @{};
    id rawFormats = payload[@"formats"];
    if (!rawFormats && [payload[@"format"] isKindOfClass:NSString.class]) rawFormats = @[payload[@"format"]];
    NSArray<NSString *> *formats = OlympusValidatedFormats(rawFormats, error);
    NSUInteger maxRounds = MIN(MAX([payload[@"maxRounds"] unsignedIntegerValue], (NSUInteger)1), (NSUInteger)5);
    if (!formats) return nil;
    if (!prompt.length || !professorPrompt.length) { if (error) *error = CycleError(2, @"Faltan los prompts de Claude o ChatGPT."); return nil; }

    NSString *runDirectory = OlympusBeginRun(error);
    if (!runDirectory) return nil;
    NSArray<NSDictionary *> *currentFiles = @[];
    NSString *evaluation = @"";
    NSNumber *score = nil;
    BOOL chatStarted = NO;

    @try {
        NSString *claudePrompt = [prompt stringByAppendingString:StrictFileInstruction(formats, 1)];
        for (NSUInteger round = 1; round <= maxRounds; round++) {
            if (Cancelled(cancelled, error)) { OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": @"comprobando modelo", @"round": @(round), @"status": @"Olympus está comprobando el modelo de Claude…" });
            NSError *stepError = nil;
            if (!OlympusEnsureModelSelection(ClaudeBundle, claudeSelection, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": round == 1 ? @"desarrollando" : @"revisando", @"round": @(round), @"status": round == 1 ? @"Claude está desarrollando todos los archivos solicitados…" : @"Claude está aplicando la corrección a la entrega completa…" });

            NSDictionary *downloadSnapshot = OlympusSnapshotDownloads();
            NSMutableDictionary<NSString *, NSNumber *> *previousButtons = [NSMutableDictionary dictionary];
            for (NSString *format in formats) previousButtons[format] = @(round == 1 ? 0 : OlympusDownloadButtonCount(ClaudeBundle, format));
            NSUInteger previousOfficeButtons = formats.count > 1 ? (round == 1 ? 0 : OlympusOfficeDownloadButtonCount(ClaudeBundle)) : 0;

            BOOL sent = round == 1 ? OlympusSendPromptInNewChat(ClaudeBundle, claudePrompt, &stepError) : OlympusSendPromptInActiveChat(ClaudeBundle, claudePrompt, &stepError);
            if (!sent) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            if (formats.count > 1 && !OlympusWaitAndPressNewOfficeDownloads(ClaudeBundle, previousOfficeButtons, formats.count, 480, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }

            NSMutableArray<NSDictionary *> *roundFiles = [NSMutableArray array];
            NSMutableArray<NSString *> *extractedSections = [NSMutableArray array];
            for (NSString *format in formats) {
                if (formats.count == 1 && !OlympusWaitAndPressNewDownload(ClaudeBundle, format, previousButtons[format].unsignedIntegerValue, 480, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
                if (Cancelled(cancelled, error)) { OlympusCleanRun(runDirectory); return nil; }
                NSURL *download = OlympusWaitForNewOfficeFile(downloadSnapshot, format, 120, &stepError);
                if (!download) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
                NSURL *currentFile = OlympusCopyVersionToRun(download, runDirectory, round, &stepError);
                if (!currentFile) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
                NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:currentFile.path error:nil];
                if ([attributes fileSize] > 40 * 1024 * 1024) { if (error) *error = CycleError(4, @"Uno de los archivos generados supera los 40 MB."); OlympusCleanRun(runDirectory); return nil; }
                NSString *fileText = OlympusExtractOfficeFile(currentFile, &stepError);
                if (!fileText) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
                NSDictionary *publicFile = PublicFile(currentFile, download, format, &stepError);
                if (!publicFile) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
                [roundFiles addObject:publicFile];
                [extractedSections addObject:[NSString stringWithFormat:@"ARCHIVO %@ — %@:\n%@", FormatName(format), download.lastPathComponent, fileText]];
                progress(@{ @"stage": @"archivo recibido", @"round": @(round), @"fileName": JoinedFileNames(roundFiles), @"status": [NSString stringWithFormat:@"Olympus recibió %@ y está preparando la revisión conjunta…", download.lastPathComponent] });
            }
            currentFiles = roundFiles;

            NSString *marker = [NSString stringWithFormat:@"OLYMPUS_EVALUACION_RONDA_%lu_%@", (unsigned long)round, NSUUID.UUID.UUIDString];
            NSString *evaluationPrompt = [NSString stringWithFormat:@"%@\n\n%@\n\nActuá como catedrático y corregí esta entrega completa sobre 10 según las consignas, la rúbrica y el material. Evaluá conjuntamente todos los archivos solicitados: si uno falta o no corresponde a su formato, no puede aprobarse. Verificá datos, cálculos, afirmaciones y citas. No inventes fuentes. Enumerá todos los cambios concretos necesarios, indicando el archivo al que corresponde cada uno. Cerrá obligatoriamente con una línea independiente de formato exacto CALIFICACIÓN: X/10.\n\nCONTEXTO ACADÉMICO DEL TP:\n%@\n\nCONTENIDO EXTRAÍDO DE LA ENTREGA DE CLAUDE:\n%@", marker, professorPrompt, reviewContext, [extractedSections componentsJoinedByString:@"\n\n"]];
            NSString *fileNames = JoinedFileNames(currentFiles);
            progress(@{ @"stage": @"comprobando modelo", @"round": @(round), @"fileName": fileNames, @"status": @"Olympus está comprobando el modelo de ChatGPT…" });
            if (!OlympusEnsureModelSelection(ChatGPTBundle, chatGPTSelection, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": @"corrigiendo", @"round": @(round), @"fileName": fileNames, @"status": @"ChatGPT está corrigiendo la entrega completa como catedrático…" });
            BOOL evaluationSent = chatStarted ? OlympusSendPromptInActiveChat(ChatGPTBundle, evaluationPrompt, &stepError) : OlympusSendPromptInNewChat(ChatGPTBundle, evaluationPrompt, &stepError);
            if (!evaluationSent) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            chatStarted = YES;
            evaluation = OlympusWaitForScoredResponse(ChatGPTBundle, evaluationPrompt, 480, &stepError);
            if (!evaluation) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
            score = OlympusScoreFromEvaluation(evaluation);
            if (!score) { if (error) *error = CycleError(5, @"No pude reconocer la calificación final de ChatGPT."); OlympusCleanRun(runDirectory); return nil; }
            progress(@{ @"stage": score.doubleValue == 10 ? @"aprobado" : @"corrección recibida", @"round": @(round), @"fileName": fileNames, @"evaluation": evaluation, @"score": score, @"status": score.doubleValue == 10 ? @"ChatGPT aprobó la entrega completa con 10/10." : @"ChatGPT pidió cambios; Olympus volverá a Claude con la corrección completa." });
            if (score.doubleValue == 10) {
                return @{ @"approved": @YES, @"rounds": @(round), @"formats": formats, @"files": currentFiles, @"fileName": fileNames, @"evaluation": evaluation, @"score": @10, @"runDirectory": runDirectory };
            }
            if (round < maxRounds) {
                claudePrompt = [NSString stringWithFormat:@"Aplicá todas las correcciones del catedrático a la entrega de la ronda anterior y generá un conjunto completo que la reemplace. Corregí coordinadamente todos los archivos, aun cuando una observación mencione sólo uno. Conservá únicamente datos, cálculos, normas y citas verificables.\n\nCORRECCIÓN COMPLETA DE CHATGPT:\n%@%@", evaluation, StrictFileInstruction(formats, round + 1)];
            }
        }
        OlympusCleanRun(runDirectory);
        return @{ @"approved": @NO, @"rounds": @(maxRounds), @"fileName": JoinedFileNames(currentFiles), @"evaluation": evaluation, @"score": score ?: @0, @"status": @"Se alcanzaron tres rondas sin obtener 10/10. No se publicó ningún archivo. Podés agregar una indicación y volver a iniciar." };
    } @catch (NSException *exception) {
        OlympusCleanRun(runDirectory);
        if (error) *error = CycleError(8, exception.reason ?: @"El ciclo nativo falló.");
        return nil;
    }
}
