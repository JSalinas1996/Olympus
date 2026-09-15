#import "StudyReportCoordinator.h"
#import "AIApplication.h"
#import "AIModelController.h"
#import "FileCycle.h"

static NSString * const ClaudeBundle = @"com.anthropic.claudefordesktop";

static NSError *ReportError(NSInteger code, NSString *message) {
    return [NSError errorWithDomain:@"OlympusStudyReport" code:code userInfo:@{NSLocalizedDescriptionKey: message}];
}

static NSDictionary *PublicWord(NSURL *file, NSString *originalName, NSError **error) {
    NSData *bytes = [NSData dataWithContentsOfURL:file options:NSDataReadingMappedIfSafe error:error]; if (!bytes) return nil;
    return @{ @"fileName": originalName.length ? originalName : @"Informe técnico final.docx", @"mimeType": @"application/vnd.openxmlformats-officedocument.wordprocessingml.document", @"fileBase64": [bytes base64EncodedStringWithOptions:0] };
}

static NSString *SafeLogoName(NSString *name) {
    NSString *last = name.lastPathComponent; NSString *extension = last.pathExtension.lowercaseString;
    if (![@[@"png", @"jpg", @"jpeg"] containsObject:extension]) return @"";
    NSCharacterSet *unsafe = [[NSCharacterSet alphanumericCharacterSet] invertedSet];
    NSString *stem = [[[last stringByDeletingPathExtension] componentsSeparatedByCharactersInSet:unsafe] componentsJoinedByString:@""];
    if (!stem.length) stem = @"logo";
    return [NSString stringWithFormat:@"%@.%@", stem, extension];
}

NSDictionary *OlympusRunStudyReport(NSDictionary *payload, OlympusProgressHandler progress, OlympusCancellationCheck cancelled, NSError **error) {
    NSString *prompt = [payload[@"prompt"] isKindOfClass:NSString.class] ? payload[@"prompt"] : @"";
    NSDictionary *selection = [payload[@"claudeModel"] isKindOfClass:NSDictionary.class] ? payload[@"claudeModel"] : @{};
    NSDictionary *logo = [payload[@"logo"] isKindOfClass:NSDictionary.class] ? payload[@"logo"] : @{};
    NSString *logoName = [logo[@"fileName"] isKindOfClass:NSString.class] ? SafeLogoName(logo[@"fileName"]) : @"";
    NSString *logoBase64 = [logo[@"fileBase64"] isKindOfClass:NSString.class] ? logo[@"fileBase64"] : @"";
    if (!prompt.length || !logoName.length || !logoBase64.length) { if (error) *error = ReportError(1, @"Faltan el prompt o el logo del informe."); return nil; }
    if (cancelled && cancelled()) { if (error) *error = ReportError(9, @"Generación cancelada."); return nil; }
    progress(@{ @"stage": @"comprobando modelo", @"status": @"Olympus está comprobando el modelo de Claude…" });
    if (!OlympusEnsureModelSelection(ClaudeBundle, selection, error)) return nil;
    NSString *runDirectory = OlympusBeginRun(error); if (!runDirectory) return nil;
    @try {
        NSData *logoData = [[NSData alloc] initWithBase64EncodedString:logoBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
        if (!logoData.length || logoData.length > 10 * 1024 * 1024) { if (error) *error = ReportError(2, @"El logo está vacío o supera los 10 MB."); OlympusCleanRun(runDirectory); return nil; }
        NSURL *logoURL = [NSURL fileURLWithPath:[runDirectory stringByAppendingPathComponent:logoName]];
        if (![logoData writeToURL:logoURL options:NSDataWritingAtomic error:error]) { OlympusCleanRun(runDirectory); return nil; }
        NSDictionary *downloadSnapshot = OlympusSnapshotDownloads();
        NSString *strictPrompt = [prompt stringByAppendingString:@"\n\nINSTRUCCIÓN DE ARCHIVO DE OLYMPUS: Generá exactamente un archivo Word (.docx), sin PDF ni archivos adicionales. Insertá dentro del Word el logo que está adjunto a esta conversación. No respondas sólo con texto: el archivo descargable es obligatorio."];
        progress(@{ @"stage": @"generando", @"status": @"Claude está generando el informe técnico Word con el logo…" });
        NSError *stepError = nil;
        if (!OlympusSendPromptWithAttachmentInNewChat(ClaudeBundle, strictPrompt, logoURL, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
        if (!OlympusWaitAndPressNewDownload(ClaudeBundle, @"docx", 0, 480, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
        if (cancelled && cancelled()) { if (error) *error = ReportError(9, @"Generación cancelada."); OlympusCleanRun(runDirectory); return nil; }
        NSURL *download = OlympusWaitForNewOfficeFile(downloadSnapshot, @"docx", 120, &stepError);
        if (!download) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
        NSURL *current = OlympusCopyVersionToRun(download, runDirectory, 1, &stepError);
        if (!current) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
        NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:current.path error:nil];
        if ([attributes fileSize] > 40 * 1024 * 1024) { if (error) *error = ReportError(3, @"El informe supera los 40 MB."); OlympusCleanRun(runDirectory); return nil; }
        if (!OlympusExtractOfficeFile(current, &stepError)) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
        if (!OlympusDocxContainsEmbeddedImage(current)) { if (error) *error = ReportError(4, @"El Word generado no contiene el logo incorporado."); OlympusCleanRun(runDirectory); return nil; }
        NSDictionary *file = PublicWord(current, download.lastPathComponent, &stepError);
        if (!file) { if (error) *error = stepError; OlympusCleanRun(runDirectory); return nil; }
        progress(@{ @"stage": @"archivo recibido", @"fileName": download.lastPathComponent, @"status": @"Olympus comprobó el Word y el logo incorporado." });
        return @{ @"file": file, @"runDirectory": runDirectory };
    } @catch (NSException *exception) {
        OlympusCleanRun(runDirectory); if (error) *error = ReportError(8, exception.reason ?: @"La generación del informe falló."); return nil;
    }
}
