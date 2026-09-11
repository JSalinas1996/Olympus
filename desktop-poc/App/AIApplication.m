#import "AIApplication.h"
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

static NSError *AIError(NSInteger code, NSString *message) {
    return [NSError errorWithDomain:@"OlympusAIApplication" code:code userInfo:@{NSLocalizedDescriptionKey: message}];
}

static id AXReadValue(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess) return nil;
    return CFBridgingRelease(value);
}

static NSArray *AXChildren(AXUIElementRef element) {
    id value = AXReadValue(element, kAXChildrenAttribute);
    return [value isKindOfClass:NSArray.class] ? value : @[];
}

static NSString *AXString(AXUIElementRef element, CFStringRef attribute) {
    id value = AXReadValue(element, attribute);
    if ([value isKindOfClass:NSURL.class]) return [value absoluteString];
    return [value isKindOfClass:NSString.class] ? value : @"";
}

static BOOL ReadFrame(AXUIElementRef element, CGRect *frame) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, CFSTR("AXFrame"), &value) == kAXErrorSuccess) {
        BOOL ok = AXValueGetValue(value, kAXValueCGRectType, frame); CFRelease(value); if (ok) return YES;
    }
    CFTypeRef positionValue = NULL, sizeValue = NULL;
    if (AXUIElementCopyAttributeValue(element, kAXPositionAttribute, &positionValue) != kAXErrorSuccess || AXUIElementCopyAttributeValue(element, kAXSizeAttribute, &sizeValue) != kAXErrorSuccess) {
        if (positionValue) CFRelease(positionValue); if (sizeValue) CFRelease(sizeValue); return NO;
    }
    CGPoint position = CGPointZero; CGSize size = CGSizeZero;
    BOOL ok = AXValueGetValue(positionValue, kAXValueCGPointType, &position) && AXValueGetValue(sizeValue, kAXValueCGSizeType, &size);
    CFRelease(positionValue); CFRelease(sizeValue); if (ok) *frame = CGRectMake(position.x, position.y, size.width, size.height); return ok;
}

static BOOL ClickElement(AXUIElementRef element) {
    if (AXUIElementPerformAction(element, kAXPressAction) == kAXErrorSuccess) return YES;
    CGRect frame = CGRectZero; if (!ReadFrame(element, &frame) || CGRectIsEmpty(frame)) return NO;
    CGPoint center = CGPointMake(CGRectGetMidX(frame), CGRectGetMidY(frame));
    CGEventRef move = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, center, kCGMouseButtonLeft);
    CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, center, kCGMouseButtonLeft);
    CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, center, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, move); CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up);
    CFRelease(move); CFRelease(down); CFRelease(up); return YES;
}

static NSRunningApplication *RaiseApplication(NSString *bundleIdentifier, NSError **error) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application) { if (error) *error = AIError(1, @"La aplicación requerida no está abierta."); return nil; }
    if (!AXIsProcessTrusted()) { if (error) *error = AIError(2, @"Olympus no tiene permiso de Accesibilidad."); return nil; }
    [application activateWithOptions:NSApplicationActivateAllWindows];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    id windows = AXReadValue(root, kAXWindowsAttribute);
    if ([windows isKindOfClass:NSArray.class] && [windows count]) AXUIElementPerformAction((__bridge AXUIElementRef)[windows firstObject], kAXRaiseAction);
    CFRelease(root); [NSThread sleepForTimeInterval:1.5]; return application;
}

static NSString *ElementLabel(AXUIElementRef element) {
    NSMutableArray *parts = [NSMutableArray array];
    for (NSString *attribute in @[(NSString *)kAXTitleAttribute, (NSString *)kAXDescriptionAttribute, (NSString *)kAXHelpAttribute, (NSString *)kAXValueAttribute, (NSString *)kAXIdentifierAttribute]) {
        NSString *value = AXString(element, (__bridge CFStringRef)attribute);
        if (value.length && value.length < 500) [parts addObject:value];
    }
    return [[parts componentsJoinedByString:@" "] lowercaseString];
}

static BOOL PressNewChat(NSRunningApplication *application) {
    for (NSUInteger attempt = 0; attempt < 4; attempt++) {
        AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
        NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root]; BOOL pressed = NO;
        for (NSUInteger cursor = 0; cursor < queue.count && cursor < 8000 && !pressed; cursor++) {
            AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor]; NSString *role = AXString(element, kAXRoleAttribute);
            if ([role isEqualToString:(NSString *)kAXButtonRole]) {
                NSString *label = ElementLabel(element);
                BOOL exact = [label isEqualToString:@"nuevo"] || [label isEqualToString:@"nuevo chat"] || [label isEqualToString:@"new chat"] || [label isEqualToString:@"nueva tarea"] || [label isEqualToString:@"new task"];
                BOOL described = [label containsString:@"nuevo chat"] || [label containsString:@"chat nuevo"] || [label containsString:@"new chat"] || [label containsString:@"nueva tarea"] || [label containsString:@"new task"];
                if (exact || described) pressed = ClickElement(element);
            }
            [queue addObjectsFromArray:AXChildren(element)];
        }
        CFRelease(root);
        if (pressed) { [NSThread sleepForTimeInterval:2.0]; return YES; }
        [NSThread sleepForTimeInterval:1.0];
    }
    return NO;
}

static AXUIElementRef CopyBestComposer(NSRunningApplication *application) CF_RETURNS_RETAINED {
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    id windows = AXReadValue(root, kAXWindowsAttribute);
    NSMutableArray *queue = [NSMutableArray array];
    if ([windows isKindOfClass:NSArray.class] && [windows count]) [queue addObject:[windows firstObject]]; else [queue addObject:(__bridge id)root];
    AXUIElementRef best = NULL; double bestScore = -1;
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 10000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor]; Boolean settable = false;
        NSString *role = AXString(element, kAXRoleAttribute);
        BOOL editableRole = [role isEqualToString:(NSString *)kAXTextAreaRole] || [role isEqualToString:(NSString *)kAXTextFieldRole];
        if (editableRole && AXUIElementIsAttributeSettable(element, kAXValueAttribute, &settable) == kAXErrorSuccess && settable) {
            CGRect frame = CGRectZero; ReadFrame(element, &frame); NSString *label = ElementLabel(element);
            double score = ([role isEqualToString:(NSString *)kAXTextAreaRole] ? 1000000 : 0) + MIN(frame.size.width * frame.size.height, 800000);
            if ([label containsString:@"message"] || [label containsString:@"mensaje"] || [label containsString:@"prompt"]) score += 2000000;
            if ([label containsString:@"search"] || [label containsString:@"buscar"]) score -= 3000000;
            if (frame.size.width < 200 || frame.size.height < 30) score -= 1000000;
            if (score >= bestScore) { best = element; bestScore = score; }
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    if (best) CFRetain(best); CFRelease(root); return best;
}

static BOOL SendPrompt(NSRunningApplication *application, NSString *prompt, NSError **error) {
    for (NSUInteger attempt = 0; attempt < 10; attempt++) {
        AXUIElementRef target = CopyBestComposer(application);
        if (target) {
            AXUIElementSetAttributeValue(target, kAXFocusedAttribute, kCFBooleanTrue);
            AXError result = AXUIElementSetAttributeValue(target, kAXValueAttribute, (__bridge CFTypeRef)prompt);
            NSString *value = AXString(target, kAXValueAttribute);
            if (result == kAXErrorSuccess && (value.length == 0 || [value containsString:[prompt substringToIndex:MIN((NSUInteger)40, prompt.length)]])) {
                CGEventRef down = CGEventCreateKeyboardEvent(NULL, 36, true), up = CGEventCreateKeyboardEvent(NULL, 36, false);
                CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up); CFRelease(down); CFRelease(up); CFRelease(target); return YES;
            }
            CFRelease(target);
        }
        [NSThread sleepForTimeInterval:1.5];
    }
    if (error) *error = AIError(4, @"No encontré un cuadro de mensaje editable y verificable."); return NO;
}

NSUInteger OlympusEditableControlCount(NSString *bundleIdentifier) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application || !AXIsProcessTrusted()) return 0;
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root]; NSUInteger count = 0;
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 8000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor]; Boolean settable = false;
        if (AXUIElementIsAttributeSettable(element, kAXValueAttribute, &settable) == kAXErrorSuccess && settable) count++;
        [queue addObjectsFromArray:AXChildren(element)];
    }
    CFRelease(root); return count;
}

BOOL OlympusSendPromptInNewChat(NSString *bundleIdentifier, NSString *prompt, NSError **error) {
    NSRunningApplication *application = RaiseApplication(bundleIdentifier, error); if (!application) return NO;
    if (!PressNewChat(application)) { if (error) *error = AIError(3, @"No pude abrir y confirmar una conversación nueva."); return NO; }
    return SendPrompt(application, prompt, error);
}

BOOL OlympusSendPromptInActiveChat(NSString *bundleIdentifier, NSString *prompt, NSError **error) {
    NSRunningApplication *application = RaiseApplication(bundleIdentifier, error); if (!application) return NO;
    return SendPrompt(application, prompt, error);
}

static NSString *Normalized(NSString *value) {
    NSArray *parts = [value componentsSeparatedByCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    return [[parts filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSString *part, NSDictionary *bindings) { return part.length > 0; }]] componentsJoinedByString:@" "];
}

static void CollectResponse(AXUIElementRef element, NSString *prompt, BOOL *afterPrompt, NSMutableArray<NSString *> *parts, NSString **scored) {
    NSString *normalizedPrompt = Normalized(prompt); NSString *prefix = [normalizedPrompt substringToIndex:MIN((NSUInteger)60, normalizedPrompt.length)];
    for (NSString *attribute in @[(NSString *)kAXValueAttribute, (NSString *)kAXTitleAttribute, (NSString *)kAXDescriptionAttribute]) {
        NSString *text = [AXString(element, (__bridge CFStringRef)attribute) stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet]; if (!text.length) continue;
        NSString *normalized = Normalized(text), *lower = text.lowercaseString;
        if (([lower containsString:@"calificación:"] || [lower containsString:@"calificacion:"]) && text.length > (*scored).length) *scored = text;
        if ([normalized isEqualToString:normalizedPrompt] || (prefix.length && [normalized containsString:prefix])) { *afterPrompt = YES; continue; }
        BOOL heading = [lower hasPrefix:@"claude respondió:"] || [lower hasPrefix:@"claude respondio:"] || [lower hasPrefix:@"chatgpt respondió:"] || [lower hasPrefix:@"chatgpt respondio:"] || [lower hasPrefix:@"chatgpt dijo:"];
        if (heading) *afterPrompt = YES;
        BOOL chrome = [lower containsString:@"escriba su mensaje"] || [lower containsString:@"message chatgpt"] || [lower isEqualToString:@"ahora"];
        if (*afterPrompt && !chrome && text.length > 12 && ![parts.lastObject isEqualToString:text]) [parts addObject:text];
    }
    for (id child in AXChildren(element)) CollectResponse((__bridge AXUIElementRef)child, prompt, afterPrompt, parts, scored);
}

static NSString *CurrentResponse(NSString *bundleIdentifier, NSString *prompt) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject; if (!application) return @"";
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); BOOL after = NO; NSMutableArray *parts = [NSMutableArray array]; NSString *scored = @"";
    CollectResponse(root, prompt, &after, parts, &scored); CFRelease(root);
    if (scored.length > 80) return scored;
    NSString *joined = [parts componentsJoinedByString:@"\n"]; return joined.length > 150 ? joined : @"";
}

static BOOL ContainsScore(NSString *text) {
    return [text rangeOfString:@"calificaci[oó]n\\s*:\\s*(10|[0-9](?:[.,][0-9]+)?)\\s*(?:/|sobre)\\s*10" options:NSRegularExpressionSearch | NSCaseInsensitiveSearch].location != NSNotFound;
}

NSString *OlympusWaitForScoredResponse(NSString *bundleIdentifier, NSString *sentPrompt, NSTimeInterval timeout, NSError **error) {
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout]; NSString *previous = @""; NSUInteger stable = 0;
    while (deadline.timeIntervalSinceNow > 0) {
        [NSThread sleepForTimeInterval:4.0]; NSString *candidate = CurrentResponse(bundleIdentifier, sentPrompt);
        if (ContainsScore(candidate) && [candidate isEqualToString:previous]) stable++; else stable = 0;
        previous = candidate; if (stable >= 2) return candidate;
    }
    if (error) *error = AIError(5, @"ChatGPT no devolvió una corrección completa con CALIFICACIÓN: X/10 dentro del tiempo esperado."); return nil;
}

static NSArray *CopyDownloadButtons(NSString *bundleIdentifier, NSString *extension) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject; if (!application) return @[];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root], *matches = [NSMutableArray array];
    NSString *needle = [NSString stringWithFormat:@".%@", extension.lowercaseString];
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 12000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor]; NSString *role = AXString(element, kAXRoleAttribute);
        if ([role isEqualToString:(NSString *)kAXButtonRole] || [role isEqualToString:@"AXLink"]) {
            NSString *label = ElementLabel(element); BOOL fileLabel = [label containsString:needle];
            BOOL downloadLabel = [label containsString:@"descargar archivo"] || [label containsString:@"descargar y abrir"] || [label containsString:@"download file"];
            BOOL excluded = [label containsString:@"actualizar"] || [label containsString:@"update"] || [label containsString:@"install"];
            if ((fileLabel || downloadLabel) && !excluded) [matches addObject:(__bridge id)element];
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    CFRelease(root); return matches;
}

NSUInteger OlympusDownloadButtonCount(NSString *bundleIdentifier, NSString *extension) {
    return CopyDownloadButtons(bundleIdentifier, extension).count;
}

BOOL OlympusWaitAndPressNewDownload(NSString *bundleIdentifier, NSString *extension, NSUInteger previousCount, NSTimeInterval timeout, NSError **error) {
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout];
    while (deadline.timeIntervalSinceNow > 0) {
        NSArray *buttons = CopyDownloadButtons(bundleIdentifier, extension);
        if (buttons.count > previousCount) {
            AXUIElementRef button = (__bridge AXUIElementRef)buttons.lastObject;
            if (ClickElement(button)) return YES;
        }
        [NSThread sleepForTimeInterval:3.0];
    }
    if (error) *error = AIError(6, [NSString stringWithFormat:@"Claude no mostró un archivo .%@ descargable dentro del tiempo esperado.", extension]); return NO;
}
