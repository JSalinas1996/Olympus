#import "FileCycle.h"

static NSError *FileCycleError(NSInteger code, NSString *message) {
    return [NSError errorWithDomain:@"OlympusFileCycle" code:code userInfo:@{NSLocalizedDescriptionKey: message}];
}

static NSString *DownloadsDirectory(void) {
    NSArray<NSURL *> *urls = [[NSFileManager defaultManager] URLsForDirectory:NSDownloadsDirectory inDomains:NSUserDomainMask];
    return urls.firstObject.path ?: [NSHomeDirectory() stringByAppendingPathComponent:@"Downloads"];
}

static NSDictionary *FileFacts(NSURL *url) {
    NSNumber *size = nil, *regular = nil; NSDate *modified = nil;
    [url getResourceValue:&size forKey:NSURLFileSizeKey error:nil];
    [url getResourceValue:&regular forKey:NSURLIsRegularFileKey error:nil];
    [url getResourceValue:&modified forKey:NSURLContentModificationDateKey error:nil];
    return @{ @"size": size ?: @0, @"modified": modified ?: [NSDate distantPast], @"regular": regular ?: @NO };
}

NSString *OlympusBeginRun(NSError **error) {
    NSString *root = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/Olympus Campus/Runs"];
    NSString *run = [root stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    if (![[NSFileManager defaultManager] createDirectoryAtPath:run withIntermediateDirectories:YES attributes:@{NSFilePosixPermissions: @0700} error:error]) return nil;
    return run;
}

NSDictionary<NSString *, NSDictionary *> *OlympusSnapshotDownloads(void) {
    NSMutableDictionary *snapshot = [NSMutableDictionary dictionary];
    NSArray<NSURL *> *files = [[NSFileManager defaultManager] contentsOfDirectoryAtURL:[NSURL fileURLWithPath:DownloadsDirectory()] includingPropertiesForKeys:@[NSURLFileSizeKey, NSURLContentModificationDateKey, NSURLIsRegularFileKey] options:NSDirectoryEnumerationSkipsHiddenFiles error:nil] ?: @[];
    for (NSURL *url in files) snapshot[url.path] = FileFacts(url);
    return snapshot;
}

NSURL *OlympusWaitForNewOfficeFile(NSDictionary<NSString *, NSDictionary *> *snapshot, NSString *extension, NSTimeInterval timeout, NSError **error) {
    NSString *wanted = [[extension stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"."]] lowercaseString];
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout];
    NSString *stablePath = nil; unsigned long long stableSize = 0; NSUInteger stablePolls = 0;
    while (deadline.timeIntervalSinceNow > 0) {
        NSArray<NSURL *> *files = [[NSFileManager defaultManager] contentsOfDirectoryAtURL:[NSURL fileURLWithPath:DownloadsDirectory()] includingPropertiesForKeys:@[NSURLFileSizeKey, NSURLContentModificationDateKey, NSURLIsRegularFileKey] options:NSDirectoryEnumerationSkipsHiddenFiles error:nil] ?: @[];
        NSMutableArray<NSURL *> *candidates = [NSMutableArray array];
        for (NSURL *url in files) {
            if (![url.pathExtension.lowercaseString isEqualToString:wanted]) continue;
            NSDictionary *facts = FileFacts(url); if (![facts[@"regular"] boolValue] || [facts[@"size"] unsignedLongLongValue] == 0) continue;
            NSDictionary *before = snapshot[url.path];
            BOOL changed = !before || ![before[@"size"] isEqual:facts[@"size"]] || ![before[@"modified"] isEqual:facts[@"modified"]];
            if (changed) [candidates addObject:url];
        }
        if (candidates.count > 1) {
            if (error) *error = FileCycleError(3, @"Claude produjo más de un archivo compatible en la misma ronda; Olympus no puede elegir uno sin riesgo.");
            return nil;
        }
        if (candidates.count == 1) {
            NSURL *candidate = candidates.firstObject; unsigned long long size = [FileFacts(candidate)[@"size"] unsignedLongLongValue];
            if ([candidate.path isEqualToString:stablePath] && size == stableSize) stablePolls++; else { stablePath = candidate.path; stableSize = size; stablePolls = 1; }
            if (stablePolls >= 3) return candidate;
        } else { stablePath = nil; stableSize = 0; stablePolls = 0; }
        [NSThread sleepForTimeInterval:1.0];
    }
    if (error) *error = FileCycleError(4, [NSString stringWithFormat:@"No apareció una descarga .%@ nueva y completa dentro del tiempo esperado.", wanted]);
    return nil;
}

NSURL *OlympusCopyVersionToRun(NSURL *source, NSString *runDirectory, NSUInteger round, NSError **error) {
    NSString *name = [NSString stringWithFormat:@"round-%lu.%@", (unsigned long)round, source.pathExtension.lowercaseString];
    NSURL *destination = [NSURL fileURLWithPath:[runDirectory stringByAppendingPathComponent:name]];
    [[NSFileManager defaultManager] removeItemAtURL:destination error:nil];
    if (![[NSFileManager defaultManager] copyItemAtURL:source toURL:destination error:error]) return nil;
    return destination;
}

static NSString *RunTask(NSString *executable, NSArray<NSString *> *arguments, NSError **error) {
    NSTask *task = [NSTask new]; task.executableURL = [NSURL fileURLWithPath:executable]; task.arguments = arguments;
    NSPipe *output = [NSPipe pipe], *errors = [NSPipe pipe]; task.standardOutput = output; task.standardError = errors;
    NSError *launchError = nil;
    if (![task launchAndReturnError:&launchError]) { if (error) *error = launchError; return nil; }
    [task waitUntilExit];
    NSData *data = [output.fileHandleForReading readDataToEndOfFile];
    NSData *errorData = [errors.fileHandleForReading readDataToEndOfFile];
    if (task.terminationStatus != 0) {
        NSString *detail = [[NSString alloc] initWithData:errorData encoding:NSUTF8StringEncoding] ?: @"";
        if (error) *error = FileCycleError(5, detail.length ? detail : @"No se pudo extraer el contenido del archivo.");
        return nil;
    }
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

NSString *OlympusExtractOfficeFile(NSURL *file, NSError **error) {
    NSString *extension = file.pathExtension.lowercaseString;
    NSString *text = nil;
    if ([extension isEqualToString:@"docx"]) {
        text = RunTask(@"/usr/bin/textutil", @[@"-convert", @"txt", @"-stdout", file.path], error);
    } else if ([extension isEqualToString:@"xlsx"]) {
        NSString *script = @"import sys,zipfile,xml.etree.ElementTree as E,posixpath\n"
        "def local(e): return e.tag.rsplit('}',1)[-1]\n"
        "def txt(e): return ''.join(e.itertext()) if e is not None else ''\n"
        "with zipfile.ZipFile(sys.argv[1]) as z:\n"
        " s=[]\n"
        " if 'xl/sharedStrings.xml' in z.namelist():\n"
        "  root=E.fromstring(z.read('xl/sharedStrings.xml'));s=[txt(x) for x in root if local(x)=='si']\n"
        " wb=E.fromstring(z.read('xl/workbook.xml'));rr=E.fromstring(z.read('xl/_rels/workbook.xml.rels'));rels={x.attrib.get('Id'):x.attrib.get('Target') for x in rr}\n"
        " out=[]\n"
        " for sh in [x for x in wb.iter() if local(x)=='sheet']:\n"
        "  name=sh.attrib.get('name','Hoja');rid=next((v for k,v in sh.attrib.items() if local(type('T',(),{'tag':k})())=='id'),None);target=rels.get(rid)\n"
        "  if not target: continue\n"
        "  path=posixpath.normpath(posixpath.join('xl',target));root=E.fromstring(z.read(path));out.append('HOJA: '+name)\n"
        "  for c in [x for x in root.iter() if local(x)=='c']:\n"
        "   a=c.attrib.get('r','?');t=c.attrib.get('t','');v=next((txt(x) for x in c if local(x)=='v'),'');f=next((txt(x) for x in c if local(x)=='f'),'')\n"
        "   if t=='s' and v: v=s[int(v)]\n"
        "   elif t=='inlineStr': v=next((txt(x) for x in c if local(x)=='is'),'')\n"
        "   if v or f: out.append(f'{a}: {v}'+(f' | fórmula: ={f}' if f else ''))\n"
        " print('\\n'.join(out))";
        text = RunTask(@"/opt/homebrew/bin/python3", @[@"-c", script, file.path], error);
    } else {
        if (error) *error = FileCycleError(6, @"El archivo generado no es Word ni Excel.");
        return nil;
    }
    NSString *trimmed = [text stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (trimmed.length < 20) { if (error) *error = FileCycleError(7, @"El archivo generado está vacío o su contenido no se pudo leer."); return nil; }
    return trimmed;
}

void OlympusCleanRun(NSString *runDirectory) {
    if (runDirectory.length) [[NSFileManager defaultManager] removeItemAtPath:runDirectory error:nil];
}
