#import <Foundation/Foundation.h>
#import "../App/FileCycle.h"
#import "../App/CycleCoordinator.h"
#import "../App/AIModelController.h"

static void Require(BOOL condition, NSString *message) {
    if (!condition) { fprintf(stderr, "FAIL: %s\n", message.UTF8String); exit(1); }
}

static BOOL Run(NSString *executable, NSArray<NSString *> *arguments) {
    NSTask *task = [NSTask new]; task.executableURL = [NSURL fileURLWithPath:executable]; task.arguments = arguments; task.standardOutput = [NSPipe pipe]; task.standardError = [NSPipe pipe];
    if (![task launchAndReturnError:nil]) return NO; [task waitUntilExit]; return task.terminationStatus == 0;
}

int main(void) {
    @autoreleasepool {
        Require([OlympusScoreFromEvaluation(@"Observaciones\nCALIFICACIÓN: 10/10") isEqual:@10], @"reconoce 10/10");
        Require(fabs(OlympusScoreFromEvaluation(@"CALIFICACION: 8,5 SOBRE 10").doubleValue - 8.5) < 0.001, @"reconoce nota decimal");
        Require(OlympusScoreFromEvaluation(@"sin nota") == nil, @"rechaza evaluaciones sin nota");

        NSError *formatError = nil;
        Require([OlympusValidatedFormats(@[@"docx"], &formatError) isEqual:@[@"docx"]], @"acepta Word");
        Require([OlympusValidatedFormats(@[@"xlsx", @"docx", @"xlsx"], &formatError) isEqual:@[@"docx", @"xlsx"]], @"normaliza Word y Excel");
        Require(OlympusValidatedFormats(@[], &formatError) == nil, @"rechaza una selección vacía");
        Require(OlympusValidatedFormats(@[@"pdf"], &formatError) == nil, @"rechaza formatos ajenos");
        NSString *automaticWord = OlympusAutomaticDeliveryInstruction(@[@"docx"], 1);
        Require([automaticWord containsString:@"No pidas confirmaciones ni esperes un OK intermedio"], @"el ciclo automático no se detiene por un OK");
        Require([automaticWord containsString:@"exactamente un archivo Word (.docx)"], @"exige el Word seleccionado");
        Require([automaticWord containsString:@"no autoriza a inventar"], @"mantiene la prohibición de inventar");
        NSString *automaticBundle = OlympusAutomaticDeliveryInstruction(@[@"docx", @"xlsx"], 2);
        Require([automaticBundle containsString:@"exactamente un archivo Word (.docx) y exactamente un archivo Excel (.xlsx)"], @"exige ambos formatos");
        Require([automaticBundle containsString:@"RONDA 2"], @"identifica la ronda de corrección");
        Require([OlympusNormalizeModelLabel(@"  Ópus   5 ") isEqualToString:@"opus 5"], @"normaliza etiqueta de modelo");
        Require(OlympusModelLabelMatches(@"Modelo: Opus 5 Medio 1.5×", @"Opus 5", @"medium"), @"reconoce modelo y esfuerzo");
        Require(!OlympusModelLabelMatches(@"Modelo: Opus 5 Máx", @"Opus 5", @"medium"), @"rechaza esfuerzo distinto");
        Require(!OlympusModelLabelMatches(@"Modelo: Sonnet 5 Medio", @"Opus 5", @"medium"), @"rechaza modelo distinto");

        NSString *folder = [NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
        [[NSFileManager defaultManager] createDirectoryAtPath:folder withIntermediateDirectories:YES attributes:nil error:nil];
        NSString *xlsx = [folder stringByAppendingPathComponent:@"test.xlsx"];
        NSString *script = @"import sys,zipfile\nfiles={'xl/workbook.xml':'<workbook xmlns:r=\"relationships\"><sheets><sheet name=\"Cálculo\" r:id=\"rId1\"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id=\"rId1\" Target=\"worksheets/sheet1.xml\"/></Relationships>','xl/sharedStrings.xml':'<sst><si><t>Concepto</t></si></sst>','xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r=\"A1\" t=\"s\"><v>0</v></c><c r=\"B2\"><v>100</v></c><c r=\"B3\"><f>B2*1.21</f><v>121</v></c></row></sheetData></worksheet>'}\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n [z.writestr(k,v) for k,v in files.items()]";
        Require(Run(@"/opt/homebrew/bin/python3", @[@"-c", script, xlsx]), @"crea fixture xlsx");
        NSError *error = nil; NSString *excelText = OlympusExtractOfficeFile([NSURL fileURLWithPath:xlsx], &error);
        Require(excelText != nil, error.localizedDescription ?: @"extrae xlsx");
        Require([excelText containsString:@"HOJA: Cálculo"], @"incluye nombre de hoja");
        Require([excelText containsString:@"fórmula: =B2*1.21"], @"incluye fórmula");

        NSString *plain = [folder stringByAppendingPathComponent:@"source.txt"], *docx = [folder stringByAppendingPathComponent:@"source.docx"];
        [@"Trabajo de prueba Olympus con contenido académico verificable." writeToFile:plain atomically:YES encoding:NSUTF8StringEncoding error:nil];
        Require(Run(@"/usr/bin/textutil", @[@"-convert", @"docx", @"-output", docx, plain]), @"crea fixture docx");
        NSString *wordText = OlympusExtractOfficeFile([NSURL fileURLWithPath:docx], &error);
        Require([wordText containsString:@"contenido académico verificable"], @"extrae docx");
        NSString *docxWithImage = [folder stringByAppendingPathComponent:@"with-image.docx"];
        NSString *zipScript = @"import sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w') as z:\n z.writestr('word/document.xml','<document>Informe técnico válido con contenido suficiente</document>')\n z.writestr('word/media/logo.png',b'logo')";
        Require(Run(@"/opt/homebrew/bin/python3", @[@"-c", zipScript, docxWithImage]), @"crea fixture Word con imagen");
        Require(OlympusDocxContainsEmbeddedImage([NSURL fileURLWithPath:docxWithImage]), @"reconoce imagen incorporada");
        Require(!OlympusDocxContainsEmbeddedImage([NSURL fileURLWithPath:docx]), @"rechaza Word sin imagen");
        [[NSFileManager defaultManager] removeItemAtPath:folder error:nil];
        puts("FileCycleTests: OK");
    }
    return 0;
}
