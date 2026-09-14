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

static AXUIElementRef CopyFocusedWindowForApplication(AXUIElementRef root) CF_RETURNS_RETAINED {
    CFTypeRef focused = NULL;
    if (AXUIElementCopyAttributeValue(root, kAXFocusedWindowAttribute, &focused) == kAXErrorSuccess && focused) return (AXUIElementRef)focused;
    id windows = AXReadValue(root, kAXWindowsAttribute);
    if ([windows isKindOfClass:NSArray.class] && [windows count]) {
        AXUIElementRef first = (__bridge AXUIElementRef)[windows firstObject]; CFRetain(first); return first;
    }
    return NULL;
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

static BOOL ReadApplicationWindowFrame(pid_t pid, CGRect *frame) {
    NSArray *windows = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID));
    CGFloat largestArea = 0; CGRect largest = CGRectZero;
    for (NSDictionary *window in windows) {
        if ([window[(NSString *)kCGWindowOwnerPID] intValue] != pid || [window[(NSString *)kCGWindowLayer] intValue] != 0) continue;
        CGRect candidate = CGRectZero;
        if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(NSString *)kCGWindowBounds], &candidate)) continue;
        CGFloat area = candidate.size.width * candidate.size.height;
        if (candidate.size.width >= 500 && candidate.size.height >= 300 && area > largestArea) { largest = candidate; largestArea = area; }
    }
    if (largestArea <= 0) return NO; *frame = largest; return YES;
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

static NSString *ElementLabel(AXUIElementRef element);

static void PostKeyToPID(pid_t pid, CGKeyCode keyCode, CGEventFlags flags) {
    CGEventRef down = CGEventCreateKeyboardEvent(NULL, keyCode, true);
    CGEventRef up = CGEventCreateKeyboardEvent(NULL, keyCode, false);
    CGEventSetFlags(down, flags); CGEventSetFlags(up, flags);
    CGEventPostToPid(pid, down); CGEventPostToPid(pid, up);
    CFRelease(down); CFRelease(up);
}

static BOOL ClickFrameCenterForPID(AXUIElementRef element, pid_t pid) {
    CGRect frame = CGRectZero; if (!ReadFrame(element, &frame) || CGRectIsEmpty(frame)) return NO;
    CGPoint center = CGPointMake(CGRectGetMidX(frame), CGRectGetMidY(frame));
    CGEventRef move = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, center, kCGMouseButtonLeft);
    CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, center, kCGMouseButtonLeft);
    CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, center, kCGMouseButtonLeft);
    CGEventPostToPid(pid, move); CGEventPostToPid(pid, down); CGEventPostToPid(pid, up);
    CFRelease(move); CFRelease(down); CFRelease(up); return YES;
}

static AXUIElementRef CopyMatchingDescendant(AXUIElementRef root, NSSet<NSString *> *roles, NSArray<NSString *> *labels) CF_RETURNS_RETAINED {
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root];
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 12000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        NSString *role = AXString(element, kAXRoleAttribute);
        if (!roles.count || [roles containsObject:role]) {
            NSString *label = ElementLabel(element);
            for (NSString *candidate in labels) {
                if ([label isEqualToString:candidate] || [label hasPrefix:[candidate stringByAppendingString:@" "]]) {
                    CFRetain(element); return element;
                }
            }
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    return NULL;
}

static NSRunningApplication *RaiseApplication(NSString *bundleIdentifier, NSError **error) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application) { if (error) *error = AIError(1, @"La aplicación requerida no está abierta."); return nil; }
    if (!AXIsProcessTrusted()) { if (error) *error = AIError(2, @"Olympus no tiene permiso de Accesibilidad."); return nil; }
    [application activateWithOptions:NSApplicationActivateAllWindows];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    AXUIElementRef window = CopyFocusedWindowForApplication(root);
    if (window) { AXUIElementPerformAction(window, kAXRaiseAction); CFRelease(window); }
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
    if ([application.bundleIdentifier isEqualToString:@"com.openai.codex"]) {
        // The unified ChatGPT/Codex desktop app exposes this documented command
        // for a new standalone GPT conversation. It keeps the professor review
        // separate from the Olympus development task and the user's projects.
        PostKeyToPID(application.processIdentifier, 31, kCGEventFlagMaskCommand | kCGEventFlagMaskAlternate); // Command-Option-O
        [NSThread sleepForTimeInterval:2.5];
        return YES;
    }
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

    // Claude's Electron content can be opaque to Accessibility while its native
    // application menu remains available. Use the labelled File menu and its
    // labelled New chat command instead of relying on screen coordinates.
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    AXUIElementRef fileMenu = CopyMatchingDescendant(root,
        [NSSet setWithObjects:(NSString *)kAXMenuBarItemRole, nil],
        @[@"archivo", @"file"]);
    BOOL opened = fileMenu && ClickElement(fileMenu);
    if (fileMenu) CFRelease(fileMenu);
    if (opened) {
        [NSThread sleepForTimeInterval:0.5];
        AXUIElementRef newChat = CopyMatchingDescendant(root,
            [NSSet setWithObjects:(NSString *)kAXMenuItemRole, nil],
            @[@"nuevo chat", @"new chat", @"nueva tarea", @"new task"]);
        BOOL pressed = newChat && ClickElement(newChat);
        if (newChat) CFRelease(newChat);
        CFRelease(root);
        if (pressed) { [NSThread sleepForTimeInterval:2.0]; return YES; }
        PostKeyToPID(application.processIdentifier, 53, 0); // Escape closes the menu if it was opened but unusable.
        return NO;
    }
    CFRelease(root);
    return NO;
}

static AXUIElementRef CopyBestComposer(NSRunningApplication *application) CF_RETURNS_RETAINED {
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    NSMutableArray *queue = [NSMutableArray array];
    AXUIElementRef focusedWindow = CopyFocusedWindowForApplication(root);
    if (focusedWindow) [queue addObject:(__bridge id)focusedWindow]; else [queue addObject:(__bridge id)root];
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
    if (best) CFRetain(best); if (focusedWindow) CFRelease(focusedWindow); CFRelease(root); return best;
}

static NSArray<NSPasteboardItem *> *CopyPasteboardItems(NSPasteboard *pasteboard) {
    NSMutableArray<NSPasteboardItem *> *copies = [NSMutableArray array];
    for (NSPasteboardItem *item in pasteboard.pasteboardItems ?: @[]) {
        NSPasteboardItem *copy = [NSPasteboardItem new];
        for (NSPasteboardType type in item.types) {
            NSData *data = [item dataForType:type]; if (data) [copy setData:data forType:type];
        }
        [copies addObject:copy];
    }
    return copies;
}

static BOOL PasteAndVerifyFocusedComposer(NSRunningApplication *application, NSString *prompt) {
    NSPasteboard *pasteboard = NSPasteboard.generalPasteboard;
    NSArray<NSPasteboardItem *> *savedItems = CopyPasteboardItems(pasteboard);
    [pasteboard clearContents]; [pasteboard setString:prompt forType:NSPasteboardTypeString];
    PostKeyToPID(application.processIdentifier, 0, kCGEventFlagMaskCommand); // Command-A
    PostKeyToPID(application.processIdentifier, 9, kCGEventFlagMaskCommand); // Command-V
    [NSThread sleepForTimeInterval:1.2];
    PostKeyToPID(application.processIdentifier, 0, kCGEventFlagMaskCommand); // Command-A
    PostKeyToPID(application.processIdentifier, 8, kCGEventFlagMaskCommand); // Command-C
    [NSThread sleepForTimeInterval:1.0];
    NSString *copied = [pasteboard stringForType:NSPasteboardTypeString] ?: @"";
    NSString *prefix = [prompt substringToIndex:MIN((NSUInteger)80, prompt.length)];
    BOOL verified = prefix.length && [copied containsString:prefix];
    if (verified) {
        PostKeyToPID(application.processIdentifier, 124, 0); // Collapse the selection at the end before submitting.
        PostKeyToPID(application.processIdentifier, 36, 0);
    }
    [pasteboard clearContents]; if (savedItems.count) [pasteboard writeObjects:savedItems];
    return verified;
}

static BOOL SendPrompt(NSRunningApplication *application, NSString *prompt, NSError **error) {
    for (NSUInteger attempt = 0; attempt < 10; attempt++) {
        AXUIElementRef target = CopyBestComposer(application);
        if (target) {
            AXUIElementSetAttributeValue(target, kAXFocusedAttribute, kCFBooleanTrue);
            ClickFrameCenterForPID(target, application.processIdentifier); [NSThread sleepForTimeInterval:0.5];
            AXError result = AXUIElementSetAttributeValue(target, kAXValueAttribute, (__bridge CFTypeRef)prompt);
            NSString *value = AXString(target, kAXValueAttribute);
            if (result == kAXErrorSuccess && [value containsString:[prompt substringToIndex:MIN((NSUInteger)40, prompt.length)]]) {
                PostKeyToPID(application.processIdentifier, 36, 0); CFRelease(target); return YES;
            }
            if (PasteAndVerifyFocusedComposer(application, prompt)) { CFRelease(target); return YES; }
            CFRelease(target);
        }
        [NSThread sleepForTimeInterval:1.5];
    }


    // Some Electron builds expose only an opaque AX container. In that case,
    // focus the conventional bottom composer, paste, then copy its contents back
    // and compare them before pressing Return. The verification prevents a blind
    // keystroke from sending the prompt to an unrelated control.
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    AXUIElementRef window = CopyFocusedWindowForApplication(root);
    CGRect frame = CGRectZero; BOOL hasFrame = window && ReadFrame(window, &frame) && frame.size.width >= 500 && frame.size.height >= 300;
    if (!hasFrame) hasFrame = ReadApplicationWindowFrame(application.processIdentifier, &frame);
    if (window) CFRelease(window); CFRelease(root);
    if (hasFrame) {
        NSArray<NSValue *> *points = @[
            [NSValue valueWithPoint:NSMakePoint(CGRectGetMinX(frame) + frame.size.width * 0.66, CGRectGetMaxY(frame) - 55.0)],
            [NSValue valueWithPoint:NSMakePoint(CGRectGetMinX(frame) + frame.size.width * 0.66, CGRectGetMinY(frame) + frame.size.height * 0.52)],
            [NSValue valueWithPoint:NSMakePoint(CGRectGetMinX(frame) + frame.size.width * 0.66, CGRectGetMinY(frame) + frame.size.height * 0.60)]
        ];
        for (NSValue *value in points) {
            CGPoint composer = value.pointValue;
            CGEventRef move = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, composer, kCGMouseButtonLeft);
            CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, composer, kCGMouseButtonLeft);
            CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, composer, kCGMouseButtonLeft);
            CGEventPost(kCGHIDEventTap, move); CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up);
            CFRelease(move); CFRelease(down); CFRelease(up); [NSThread sleepForTimeInterval:0.3];
            if (PasteAndVerifyFocusedComposer(application, prompt)) return YES;
        }
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
        BOOL belongsToPrompt = [normalized isEqualToString:normalizedPrompt] || (prefix.length && [normalized containsString:prefix]) || (normalized.length > 12 && [normalizedPrompt containsString:normalized]);
        if (belongsToPrompt) { if ([normalized isEqualToString:normalizedPrompt] || (prefix.length && [normalized containsString:prefix])) *afterPrompt = YES; continue; }
        if (*afterPrompt && ([lower containsString:@"calificación:"] || [lower containsString:@"calificacion:"]) && text.length > (*scored).length) *scored = text;
        BOOL heading = [lower hasPrefix:@"claude respondió:"] || [lower hasPrefix:@"claude respondio:"] || [lower hasPrefix:@"chatgpt respondió:"] || [lower hasPrefix:@"chatgpt respondio:"] || [lower hasPrefix:@"chatgpt dijo:"];
        if (heading) *afterPrompt = YES;
        BOOL chrome = [lower containsString:@"escriba su mensaje"] || [lower containsString:@"message chatgpt"] || [lower isEqualToString:@"ahora"];
        if (*afterPrompt && !chrome && text.length > 12 && ![parts.lastObject isEqualToString:text]) [parts addObject:text];
    }
    for (id child in AXChildren(element)) CollectResponse((__bridge AXUIElementRef)child, prompt, afterPrompt, parts, scored);
}

static NSString *CurrentResponse(NSString *bundleIdentifier, NSString *prompt) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject; if (!application) return @"";
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); AXUIElementRef window = CopyFocusedWindowForApplication(root);
    BOOL after = NO; NSMutableArray *parts = [NSMutableArray array]; NSString *scored = @"";
    CollectResponse(window ?: root, prompt, &after, parts, &scored); if (window) CFRelease(window); CFRelease(root);
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
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); AXUIElementRef window = CopyFocusedWindowForApplication(root);
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)(window ?: root)], *matches = [NSMutableArray array];
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
    if (window) CFRelease(window); CFRelease(root); return matches;
}

NSUInteger OlympusDownloadButtonCount(NSString *bundleIdentifier, NSString *extension) {
    return CopyDownloadButtons(bundleIdentifier, extension).count;
}

static NSString *ApplicationLimitMessage(NSString *bundleIdentifier);

static NSArray *CopyOfficeDownloadButtons(NSString *bundleIdentifier) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject; if (!application) return @[];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); AXUIElementRef window = CopyFocusedWindowForApplication(root);
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)(window ?: root)], *matches = [NSMutableArray array];
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 12000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor]; NSString *role = AXString(element, kAXRoleAttribute);
        if ([role isEqualToString:(NSString *)kAXButtonRole] || [role isEqualToString:@"AXLink"]) {
            NSString *label = ElementLabel(element);
            BOOL officeLabel = [label containsString:@".docx"] || [label containsString:@".xlsx"];
            BOOL downloadLabel = [label containsString:@"descargar archivo"] || [label containsString:@"descargar y abrir"] || [label containsString:@"download file"];
            BOOL excluded = [label containsString:@"actualizar"] || [label containsString:@"update"] || [label containsString:@"install"];
            if ((officeLabel || downloadLabel) && !excluded) [matches addObject:(__bridge id)element];
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    if (window) CFRelease(window); CFRelease(root); return matches;
}

NSUInteger OlympusOfficeDownloadButtonCount(NSString *bundleIdentifier) {
    return CopyOfficeDownloadButtons(bundleIdentifier).count;
}

BOOL OlympusWaitAndPressNewOfficeDownloads(NSString *bundleIdentifier, NSUInteger previousCount, NSUInteger expectedCount, NSTimeInterval timeout, NSError **error) {
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout]; NSDate *limitCheckAt = [NSDate dateWithTimeIntervalSinceNow:6.0];
    while (deadline.timeIntervalSinceNow > 0) {
        NSArray *buttons = CopyOfficeDownloadButtons(bundleIdentifier);
        if (buttons.count >= previousCount + expectedCount) {
            NSRange newRange = NSMakeRange(buttons.count - expectedCount, expectedCount);
            for (id item in [buttons subarrayWithRange:newRange]) {
                if (!ClickElement((__bridge AXUIElementRef)item)) {
                    if (error) *error = AIError(8, @"Olympus encontró la entrega de Claude pero no pudo descargar todos los archivos.");
                    return NO;
                }
                [NSThread sleepForTimeInterval:0.7];
            }
            return YES;
        }
        if (limitCheckAt.timeIntervalSinceNow <= 0) {
            NSString *limit = ApplicationLimitMessage(bundleIdentifier);
            if (limit.length) {
                if (error) *error = AIError(7, [NSString stringWithFormat:@"Claude alcanzó el límite temporal de la suscripción. %@. Volvé a iniciar el ciclo después del horario indicado por Claude.", limit]);
                return NO;
            }
        }
        [NSThread sleepForTimeInterval:3.0];
    }
    if (error) *error = AIError(6, @"Claude no mostró todos los archivos Word/Excel descargables dentro del tiempo esperado.");
    return NO;
}

static NSString *ApplicationLimitMessage(NSString *bundleIdentifier) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject; if (!application) return nil;
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier); AXUIElementRef window = CopyFocusedWindowForApplication(root);
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)(window ?: root)]; NSString *found = nil;
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 12000 && !found; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        for (NSString *attribute in @[(NSString *)kAXValueAttribute, (NSString *)kAXTitleAttribute, (NSString *)kAXDescriptionAttribute]) {
            NSString *text = AXString(element, (__bridge CFStringRef)attribute); NSString *lower = text.lowercaseString;
            BOOL explicitSessionLimit = [lower containsString:@"you've hit your session limit"] || [lower containsString:@"you have hit your session limit"] || [lower containsString:@"alcanzaste el límite de la sesión"] || [lower containsString:@"alcanzaste el limite de la sesion"];
            if (explicitSessionLimit) { found = text; break; }
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    if (window) CFRelease(window); CFRelease(root); return found;
}

BOOL OlympusWaitAndPressNewDownload(NSString *bundleIdentifier, NSString *extension, NSUInteger previousCount, NSTimeInterval timeout, NSError **error) {
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout]; NSDate *limitCheckAt = [NSDate dateWithTimeIntervalSinceNow:6.0];
    while (deadline.timeIntervalSinceNow > 0) {
        NSArray *buttons = CopyDownloadButtons(bundleIdentifier, extension);
        if (buttons.count > previousCount) {
            AXUIElementRef button = (__bridge AXUIElementRef)buttons.lastObject;
            if (ClickElement(button)) return YES;
        }
        if (limitCheckAt.timeIntervalSinceNow <= 0) {
            NSString *limit = ApplicationLimitMessage(bundleIdentifier);
            if (limit.length) {
                if (error) *error = AIError(7, [NSString stringWithFormat:@"Claude alcanzó el límite temporal de la suscripción. %@. Volvé a iniciar el ciclo después del horario indicado por Claude.", limit]);
                return NO;
            }
        }
        [NSThread sleepForTimeInterval:3.0];
    }
    if (error) *error = AIError(6, [NSString stringWithFormat:@"Claude no mostró un archivo .%@ descargable dentro del tiempo esperado.", extension]); return NO;
}
