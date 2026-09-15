#import "AIModelController.h"
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

static NSError *ModelError(NSInteger code, NSString *bundle, NSString *model, NSString *effort, NSString *reason) {
    NSString *application = [bundle containsString:@"anthropic"] ? @"Claude" : @"ChatGPT";
    NSDictionary *labels = @{@"low": @"Bajo", @"medium": @"Medio", @"high": @"Alto", @"xhigh": @"Muy alto", @"max": @"Máx"};
    NSString *effortText = [effort isEqualToString:@"automatic"] ? @"" : [NSString stringWithFormat:@" con esfuerzo %@", labels[effort] ?: effort];
    NSString *message = [NSString stringWithFormat:@"Configuración requerida en %@: seleccioná %@%@. %@", application, model, effortText, reason ?: @""];
    return [NSError errorWithDomain:@"OlympusAIModel" code:code userInfo:@{NSLocalizedDescriptionKey: message, @"application": application, @"model": model ?: @"", @"effort": effort ?: @"automatic"}];
}

static id AXRead(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess) return nil;
    return CFBridgingRelease(value);
}

static NSArray *AXChildren(AXUIElementRef element) {
    id children = AXRead(element, kAXChildrenAttribute);
    return [children isKindOfClass:NSArray.class] ? children : @[];
}

static NSString *AXText(AXUIElementRef element) {
    NSMutableArray *parts = [NSMutableArray array];
    for (NSString *attribute in @[(NSString *)kAXTitleAttribute, (NSString *)kAXDescriptionAttribute, (NSString *)kAXHelpAttribute, (NSString *)kAXValueAttribute, (NSString *)kAXIdentifierAttribute]) {
        id raw = AXRead(element, (__bridge CFStringRef)attribute);
        if ([raw isKindOfClass:NSString.class] && [raw length] > 0 && [raw length] < 500) [parts addObject:raw];
    }
    return [parts componentsJoinedByString:@" "];
}

static BOOL ReadFrame(AXUIElementRef element, CGRect *frame) {
    CFTypeRef positionValue = NULL, sizeValue = NULL;
    if (AXUIElementCopyAttributeValue(element, kAXPositionAttribute, &positionValue) != kAXErrorSuccess || AXUIElementCopyAttributeValue(element, kAXSizeAttribute, &sizeValue) != kAXErrorSuccess) {
        if (positionValue) CFRelease(positionValue); if (sizeValue) CFRelease(sizeValue); return NO;
    }
    CGPoint position = CGPointZero; CGSize size = CGSizeZero;
    BOOL valid = AXValueGetValue(positionValue, kAXValueCGPointType, &position) && AXValueGetValue(sizeValue, kAXValueCGSizeType, &size);
    CFRelease(positionValue); CFRelease(sizeValue);
    if (valid) *frame = CGRectMake(position.x, position.y, size.width, size.height);
    return valid;
}

static BOOL Click(AXUIElementRef element) {
    if (AXUIElementPerformAction(element, kAXPressAction) == kAXErrorSuccess) return YES;
    CGRect frame = CGRectZero; if (!ReadFrame(element, &frame) || CGRectIsEmpty(frame)) return NO;
    CGPoint point = CGPointMake(CGRectGetMidX(frame), CGRectGetMidY(frame));
    CGEventRef move = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, point, kCGMouseButtonLeft);
    CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, point, kCGMouseButtonLeft);
    CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, point, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, move); CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up);
    CFRelease(move); CFRelease(down); CFRelease(up); return YES;
}

static BOOL Hover(AXUIElementRef element) {
    CGRect frame = CGRectZero; if (!ReadFrame(element, &frame) || CGRectIsEmpty(frame)) return NO;
    CGPoint point = CGPointMake(CGRectGetMidX(frame), CGRectGetMidY(frame));
    CGEventRef move = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, point, kCGMouseButtonLeft);
    CGEventPost(kCGHIDEventTap, move); CFRelease(move); return YES;
}

static void PostEscape(pid_t pid) {
    CGEventRef down = CGEventCreateKeyboardEvent(NULL, 53, true), up = CGEventCreateKeyboardEvent(NULL, 53, false);
    CGEventPostToPid(pid, down); CGEventPostToPid(pid, up); CFRelease(down); CFRelease(up);
}

NSString *OlympusNormalizeModelLabel(NSString *value) {
    NSString *folded = [[value ?: @"" stringByFoldingWithOptions:NSDiacriticInsensitiveSearch | NSCaseInsensitiveSearch locale:[NSLocale localeWithLocaleIdentifier:@"es"]] lowercaseString];
    NSArray *parts = [folded componentsSeparatedByCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    return [[parts filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSString *part, NSDictionary *bindings) { return part.length > 0; }]] componentsJoinedByString:@" "];
}

static NSArray<NSString *> *EffortAliases(NSString *effort) {
    NSDictionary *aliases = @{
        @"automatic": @[], @"low": @[@"bajo", @"low"], @"medium": @[@"medio", @"medium"],
        @"high": @[@"alto", @"high"], @"xhigh": @[@"muy alto", @"xhigh", @"extra high"],
        @"max": @[@"max", @"maximo", @"maximum"]
    };
    return aliases[OlympusNormalizeModelLabel(effort)] ?: @[OlympusNormalizeModelLabel(effort)];
}

static BOOL ContainsModel(NSString *actual, NSString *model) {
    NSRange range = [actual rangeOfString:model]; if (range.location == NSNotFound) return NO;
    NSUInteger end = NSMaxRange(range);
    if (end < actual.length) {
        unichar next = [actual characterAtIndex:end];
        if ([[NSCharacterSet alphanumericCharacterSet] characterIsMember:next] || next == '.') return NO;
    }
    return YES;
}

BOOL OlympusModelLabelMatches(NSString *actualLabel, NSString *model, NSString *effort) {
    NSString *actual = OlympusNormalizeModelLabel(actualLabel), *expectedModel = OlympusNormalizeModelLabel(model);
    if (!expectedModel.length || !ContainsModel(actual, expectedModel)) return NO;
    NSString *expectedEffort = OlympusNormalizeModelLabel(effort);
    if (!expectedEffort.length || [expectedEffort isEqualToString:@"automatic"]) return YES;
    for (NSString *alias in EffortAliases(expectedEffort)) if (alias.length && [actual containsString:alias]) return YES;
    return NO;
}

static AXUIElementRef CopyDescendant(AXUIElementRef root, BOOL (^predicate)(AXUIElementRef, NSString *, NSString *)) CF_RETURNS_RETAINED {
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root];
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 14000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        id rawRole = AXRead(element, kAXRoleAttribute);
        NSString *role = [rawRole isKindOfClass:NSString.class] ? rawRole : @"";
        NSString *label = AXText(element);
        if (predicate(element, role, label)) { CFRetain(element); return element; }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    return NULL;
}

static BOOL ActionableRole(NSString *role) {
    return [@[(NSString *)kAXButtonRole, (NSString *)kAXMenuItemRole, (NSString *)kAXRadioButtonRole, (NSString *)kAXCheckBoxRole, (NSString *)kAXPopUpButtonRole] containsObject:role];
}

static AXUIElementRef CopyModelControl(AXUIElementRef root, NSString *model) CF_RETURNS_RETAINED {
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        if (![role isEqualToString:(NSString *)kAXButtonRole] && ![role isEqualToString:(NSString *)kAXPopUpButtonRole]) return NO;
        NSString *normalized = OlympusNormalizeModelLabel(label);
        return [normalized containsString:@"modelo:"] || [normalized containsString:@"model:"] || OlympusModelLabelMatches(normalized, model, @"automatic");
    });
}

static AXUIElementRef CopyChoice(AXUIElementRef root, NSString *model, NSString *effort, BOOL requireEffort) CF_RETURNS_RETAINED {
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        if (!ActionableRole(role)) return NO;
        return OlympusModelLabelMatches(label, model, requireEffort ? effort : @"automatic");
    });
}

static AXUIElementRef CopyEffortChoice(AXUIElementRef root, NSString *effort) CF_RETURNS_RETAINED {
    NSArray *aliases = EffortAliases(effort);
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        if (!ActionableRole(role)) return NO;
        NSString *normalized = OlympusNormalizeModelLabel(label);
        for (NSString *alias in aliases) {
            if ([normalized isEqualToString:alias] ||
                [normalized hasPrefix:[alias stringByAppendingString:@" "]] ||
                [normalized isEqualToString:[@"esfuerzo " stringByAppendingString:alias]] ||
                [normalized isEqualToString:[@"effort " stringByAppendingString:alias]]) return YES;
        }
        return NO;
    });
}

static AXUIElementRef CopyEffortControl(AXUIElementRef root) CF_RETURNS_RETAINED {
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        if (!ActionableRole(role)) return NO;
        NSString *normalized = OlympusNormalizeModelLabel(label);
        return [normalized containsString:@"esfuerzo"] || [normalized containsString:@"effort"];
    });
}

BOOL OlympusEnsureModelSelection(NSString *bundleIdentifier, NSDictionary *selection, NSError **error) {
    NSString *model = [selection[@"model"] isKindOfClass:NSString.class] ? [selection[@"model"] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] : @"";
    NSString *effort = [selection[@"effort"] isKindOfClass:NSString.class] ? selection[@"effort"] : @"automatic";
    if (!model.length) { if (error) *error = ModelError(1, bundleIdentifier, @"un modelo", effort, @"Configurá el modelo en Olympus."); return NO; }
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application) { if (error) *error = ModelError(2, bundleIdentifier, model, effort, @"La aplicación no está abierta."); return NO; }
    if (!AXIsProcessTrusted()) { if (error) *error = ModelError(3, bundleIdentifier, model, effort, @"Falta el permiso de Accesibilidad."); return NO; }
    [application activateWithOptions:NSApplicationActivateAllWindows]; PostEscape(application.processIdentifier); [NSThread sleepForTimeInterval:1.0];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    AXUIElementRef control = CopyModelControl(root, model);
    if (!control) { CFRelease(root); if (error) *error = ModelError(4, bundleIdentifier, model, effort, @"No encontré el selector de modelo."); return NO; }
    NSString *current = AXText(control);
    if (OlympusModelLabelMatches(current, model, effort)) { CFRelease(control); CFRelease(root); return YES; }
    BOOL modelCorrect = OlympusModelLabelMatches(current, model, @"automatic");
    if (!modelCorrect) {
        if (!Click(control)) { CFRelease(control); CFRelease(root); if (error) *error = ModelError(5, bundleIdentifier, model, effort, @"No pude abrir el selector."); return NO; }
        CFRelease(control); control = NULL; [NSThread sleepForTimeInterval:0.8];
        AXUIElementRef modelChoice = CopyChoice(root, model, effort, NO);
        if (modelChoice) { Click(modelChoice); CFRelease(modelChoice); [NSThread sleepForTimeInterval:0.8]; }
        control = CopyModelControl(root, model); current = control ? AXText(control) : @"";
        modelCorrect = control && OlympusModelLabelMatches(current, model, @"automatic");
        if (!modelCorrect) {
            if (control) CFRelease(control); CFRelease(root); PostEscape(application.processIdentifier);
            if (error) *error = ModelError(6, bundleIdentifier, model, effort, @"Olympus no pudo seleccionar el modelo."); return NO;
        }
    }
    if (![effort isEqualToString:@"automatic"] && !OlympusModelLabelMatches(current, model, effort)) {
        if (!control) control = CopyModelControl(root, model);
        if (control) { Click(control); [NSThread sleepForTimeInterval:0.6]; }
        AXUIElementRef effortChoice = CopyEffortChoice(root, effort);
        if (!effortChoice) {
            AXUIElementRef effortControl = CopyEffortControl(root);
            if (effortControl) {
                Hover(effortControl); [NSThread sleepForTimeInterval:0.8]; effortChoice = CopyEffortChoice(root, effort);
                if (!effortChoice) { Click(effortControl); [NSThread sleepForTimeInterval:0.8]; effortChoice = CopyEffortChoice(root, effort); }
                CFRelease(effortControl);
            }
        }
        if (effortChoice) { Click(effortChoice); CFRelease(effortChoice); [NSThread sleepForTimeInterval:0.8]; }
    }
    if (control) { CFRelease(control); control = NULL; }
    control = CopyModelControl(root, model); current = control ? AXText(control) : @"";
    BOOL verified = control && OlympusModelLabelMatches(current, model, effort);
    if (control) CFRelease(control); CFRelease(root);
    if (!verified) PostEscape(application.processIdentifier);
    if (!verified && error) *error = ModelError(7, bundleIdentifier, model, effort, @"Olympus no pudo confirmar la selección exacta.");
    return verified;
}
