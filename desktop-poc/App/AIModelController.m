#import "AIModelController.h"
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

static NSString *FamilyDisplayName(NSString *family) {
    NSDictionary *names = @{
        @"opus": @"Opus (última versión)", @"sonnet": @"Sonnet (última versión)",
        @"astra": @"Astra (última versión)", @"sol": @"Sol (última versión)",
        @"terra": @"Terra (última versión)", @"luna": @"Luna (última versión)",
        @"gpt": @"GPT base (última versión)"
    };
    return names[family] ?: family.capitalizedString;
}

static NSError *ModelError(NSInteger code, NSString *bundle, NSString *model, NSString *mode, NSString *effort, NSString *reason) {
    NSString *application = [bundle containsString:@"anthropic"] ? @"Claude" : @"ChatGPT";
    NSDictionary *labels = @{@"low": @"Bajo", @"medium": @"Medio", @"high": @"Alto", @"xhigh": @"Muy alto", @"max": @"Máx"};
    NSString *effortText = [effort isEqualToString:@"automatic"] ? @"" : [NSString stringWithFormat:@" con razonamiento %@", labels[effort] ?: effort];
    NSString *modelText = [mode isEqualToString:@"family"] ? FamilyDisplayName(model) : model;
    NSString *message = [NSString stringWithFormat:@"Configuración requerida en %@: seleccioná %@%@. %@", application, modelText, effortText, reason ?: @""];
    return [NSError errorWithDomain:@"OlympusAIModel" code:code userInfo:@{NSLocalizedDescriptionKey: message, @"application": application, @"model": model ?: @"", @"modelMode": mode ?: @"exact", @"effort": effort ?: @"automatic"}];
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

static NSMutableArray *AXTraversalQueue(AXUIElementRef root) {
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root];
    id windows = AXRead(root, kAXWindowsAttribute);
    if ([windows isKindOfClass:NSArray.class]) [queue addObjectsFromArray:windows];
    id mainWindow = AXRead(root, kAXMainWindowAttribute);
    if (mainWindow) [queue addObject:mainWindow];
    id focusedWindow = AXRead(root, kAXFocusedWindowAttribute);
    if (focusedWindow && focusedWindow != mainWindow) [queue addObject:focusedWindow];
    return queue;
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

static BOOL ClickPoint(CGPoint point) {
    CGEventRef move = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, point, kCGMouseButtonLeft);
    CGEventRef down = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, point, kCGMouseButtonLeft);
    CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, point, kCGMouseButtonLeft);
    if (!move || !down || !up) {
        if (move) CFRelease(move); if (down) CFRelease(down); if (up) CFRelease(up); return NO;
    }
    CGEventPost(kCGHIDEventTap, move); [NSThread sleepForTimeInterval:0.08];
    CGEventPost(kCGHIDEventTap, down); [NSThread sleepForTimeInterval:0.08];
    CGEventPost(kCGHIDEventTap, up);
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

static void PostKey(pid_t pid, CGKeyCode keyCode) {
    CGEventRef down = CGEventCreateKeyboardEvent(NULL, keyCode, true), up = CGEventCreateKeyboardEvent(NULL, keyCode, false);
    CGEventPostToPid(pid, down); CGEventPostToPid(pid, up); CFRelease(down); CFRelease(up);
}

static void PostGlobalKey(CGKeyCode keyCode) {
    CGEventRef down = CGEventCreateKeyboardEvent(NULL, keyCode, true), up = CGEventCreateKeyboardEvent(NULL, keyCode, false);
    CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up); CFRelease(down); CFRelease(up);
}

NSString *OlympusNormalizeModelLabel(NSString *value) {
    NSString *folded = [[value ?: @"" stringByFoldingWithOptions:NSDiacriticInsensitiveSearch | NSCaseInsensitiveSearch locale:[NSLocale localeWithLocaleIdentifier:@"es"]] lowercaseString];
    NSArray *parts = [folded componentsSeparatedByCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    return [[parts filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSString *part, NSDictionary *bindings) { return part.length > 0; }]] componentsJoinedByString:@" "];
}

static NSArray<NSString *> *EffortAliases(NSString *effort) {
    NSDictionary *aliases = @{
        @"automatic": @[], @"low": @[@"bajo", @"ligero", @"low", @"light"], @"medium": @[@"medio", @"medium"],
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

static BOOL ContainsWord(NSString *label, NSString *word) {
    if (!word.length) return NO;
    NSString *escaped = [NSRegularExpression escapedPatternForString:word];
    NSString *pattern = [NSString stringWithFormat:@"(?:^|[^a-z0-9])%@(?![a-z0-9])", escaped];
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:pattern options:NSRegularExpressionCaseInsensitive error:nil];
    return [regex firstMatchInString:label options:0 range:NSMakeRange(0, label.length)] != nil;
}

static BOOL LabelMatchesEffort(NSString *label, NSString *effort) {
    NSString *normalizedEffort = OlympusNormalizeModelLabel(effort);
    if (!normalizedEffort.length || [normalizedEffort isEqualToString:@"automatic"]) return YES;
    NSString *actual = OlympusNormalizeModelLabel(label);
    if ([normalizedEffort isEqualToString:@"high"] &&
        ([actual containsString:@"muy alto"] || [actual containsString:@"extra high"] || ContainsWord(actual, @"xhigh"))) return NO;
    for (NSString *alias in EffortAliases(normalizedEffort)) {
        if (alias.length && ([alias containsString:@" "] ? [actual containsString:alias] : ContainsWord(actual, alias))) return YES;
    }
    return NO;
}

BOOL OlympusModelFamilyMatchesLabel(NSString *actualLabel, NSString *family) {
    NSString *actual = OlympusNormalizeModelLabel(actualLabel), *expected = OlympusNormalizeModelLabel(family);
    if (!expected.length) return NO;
    if ([expected isEqualToString:@"gpt"]) {
        if (!ContainsWord(actual, @"gpt")) return NO;
        for (NSString *namedFamily in @[@"astra", @"sol", @"terra", @"luna"]) if (ContainsWord(actual, namedFamily)) return NO;
        return YES;
    }
    return ContainsWord(actual, expected);
}

static NSString *VersionText(NSString *label, NSString *family) {
    NSString *actual = OlympusNormalizeModelLabel(label), *expected = OlympusNormalizeModelLabel(family);
    NSArray<NSString *> *patterns;
    if ([expected isEqualToString:@"opus"] || [expected isEqualToString:@"sonnet"]) {
        patterns = @[[NSString stringWithFormat:@"\\b%@\\s*[- ]?\\s*(\\d+(?:\\.\\d+)*)", [NSRegularExpression escapedPatternForString:expected]]];
    } else if ([expected isEqualToString:@"gpt"]) {
        patterns = @[@"\\bgpt\\s*[- ]?\\s*(\\d+(?:\\.\\d+)*)\\b"];
    } else {
        NSString *escaped = [NSRegularExpression escapedPatternForString:expected];
        patterns = @[
            [NSString stringWithFormat:@"\\bgpt\\s*[- ]?\\s*(\\d+(?:\\.\\d+)*)\\s+%@\\b", escaped],
            [NSString stringWithFormat:@"\\b%@\\s*[- ]?\\s*(\\d+(?:\\.\\d+)*)", escaped]
        ];
    }
    for (NSString *pattern in patterns) {
        NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:pattern options:NSRegularExpressionCaseInsensitive error:nil];
        NSTextCheckingResult *match = [regex firstMatchInString:actual options:0 range:NSMakeRange(0, actual.length)];
        if (match && match.numberOfRanges > 1 && [match rangeAtIndex:1].location != NSNotFound) return [actual substringWithRange:[match rangeAtIndex:1]];
    }
    return @"";
}

static NSArray<NSNumber *> *VersionComponents(NSString *label, NSString *family) {
    NSString *version = VersionText(label, family);
    if (!version.length) return @[];
    NSMutableArray<NSNumber *> *components = [NSMutableArray array];
    for (NSString *part in [version componentsSeparatedByString:@"."]) [components addObject:@(part.integerValue)];
    return components;
}

NSComparisonResult OlympusCompareModelVersions(NSString *leftLabel, NSString *rightLabel, NSString *family) {
    NSArray<NSNumber *> *left = VersionComponents(leftLabel, family), *right = VersionComponents(rightLabel, family);
    if (left.count && !right.count) return NSOrderedDescending;
    if (!left.count && right.count) return NSOrderedAscending;
    NSUInteger count = MAX(left.count, right.count);
    for (NSUInteger index = 0; index < count; index++) {
        NSInteger leftValue = index < left.count ? left[index].integerValue : 0;
        NSInteger rightValue = index < right.count ? right[index].integerValue : 0;
        if (leftValue > rightValue) return NSOrderedDescending;
        if (leftValue < rightValue) return NSOrderedAscending;
    }
    return NSOrderedSame;
}

NSString *OlympusBestModelLabel(NSArray<NSString *> *labels, NSString *family) {
    NSString *best = nil;
    for (NSString *label in labels) {
        if (!OlympusModelFamilyMatchesLabel(label, family)) continue;
        if (!best || OlympusCompareModelVersions(label, best, family) == NSOrderedDescending) best = label;
    }
    return best;
}

BOOL OlympusModelLabelMatches(NSString *actualLabel, NSString *model, NSString *effort) {
    NSString *actual = OlympusNormalizeModelLabel(actualLabel), *expectedModel = OlympusNormalizeModelLabel(model);
    if (!expectedModel.length || !ContainsModel(actual, expectedModel)) return NO;
    return LabelMatchesEffort(actual, effort);
}

static NSString *LegacyFamily(NSString *model, NSString *bundleIdentifier) {
    NSString *normalized = OlympusNormalizeModelLabel(model);
    if ([bundleIdentifier containsString:@"anthropic"]) {
        if (ContainsWord(normalized, @"opus")) return @"opus";
        if (ContainsWord(normalized, @"sonnet")) return @"sonnet";
        return @"";
    }
    for (NSString *family in @[@"astra", @"sol", @"terra", @"luna"]) if (ContainsWord(normalized, family)) return family;
    NSRegularExpression *plainGPT = [NSRegularExpression regularExpressionWithPattern:@"^gpt(?:[- ]+\\d+(?:\\.\\d+)*)?$" options:NSRegularExpressionCaseInsensitive error:nil];
    if ([plainGPT firstMatchInString:normalized options:0 range:NSMakeRange(0, normalized.length)]) return @"gpt";
    return @"";
}

static NSDictionary *NormalizedSelection(NSString *bundleIdentifier, NSDictionary *selection) {
    NSString *model = [selection[@"model"] isKindOfClass:NSString.class] ? [selection[@"model"] stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet] : @"";
    NSString *mode = [selection[@"modelMode"] isKindOfClass:NSString.class] ? OlympusNormalizeModelLabel(selection[@"modelMode"]) : @"";
    if (![mode isEqualToString:@"family"] && ![mode isEqualToString:@"exact"]) {
        NSString *legacy = LegacyFamily(model, bundleIdentifier);
        if (legacy.length) { mode = @"family"; model = legacy; } else mode = @"exact";
    }
    NSString *effort = [selection[@"effort"] isKindOfClass:NSString.class] ? OlympusNormalizeModelLabel(selection[@"effort"]) : @"automatic";
    if (!effort.length) effort = @"automatic";
    return @{@"model": OlympusNormalizeModelLabel(model), @"modelMode": mode, @"effort": effort};
}

static BOOL SelectionMatchesLabel(NSString *label, NSDictionary *selection, BOOL requireEffort) {
    NSString *model = selection[@"model"], *mode = selection[@"modelMode"], *effort = requireEffort ? selection[@"effort"] : @"automatic";
    if ([mode isEqualToString:@"family"]) {
        if (!OlympusModelFamilyMatchesLabel(label, model)) return NO;
        return LabelMatchesEffort(label, effort);
    }
    return OlympusModelLabelMatches(label, model, effort);
}

static AXUIElementRef CopyDescendant(AXUIElementRef root, BOOL (^predicate)(AXUIElementRef, NSString *, NSString *)) CF_RETURNS_RETAINED {
    NSMutableArray *queue = AXTraversalQueue(root);
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 50000; cursor++) {
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
    return [@[(NSString *)kAXButtonRole, (NSString *)kAXMenuButtonRole, (NSString *)kAXMenuItemRole, (NSString *)kAXRadioButtonRole, (NSString *)kAXCheckBoxRole, (NSString *)kAXPopUpButtonRole] containsObject:role];
}

static BOOL ClickableMenuText(AXUIElementRef element, NSString *role, NSString *label) {
    if (![role isEqualToString:(NSString *)kAXStaticTextRole] || label.length == 0 || label.length > 100) return NO;
    CGRect frame = CGRectZero;
    return ReadFrame(element, &frame) && frame.size.width > 4 && frame.size.height > 4;
}

static AXUIElementRef CopyModelControl(AXUIElementRef root, NSDictionary *selection) CF_RETURNS_RETAINED {
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        NSString *normalized = OlympusNormalizeModelLabel(label);
        if (ActionableRole(role) && ([normalized containsString:@"modelo:"] || [normalized containsString:@"model:"])) return YES;
        return ActionableRole(role) && SelectionMatchesLabel(normalized, selection, NO);
    });
}

static AXUIElementRef CopyExactChoice(AXUIElementRef root, NSDictionary *selection) CF_RETURNS_RETAINED {
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        return (ActionableRole(role) || ClickableMenuText(element, role, label)) && SelectionMatchesLabel(label, selection, NO);
    });
}

static AXUIElementRef CopyBestFamilyChoice(AXUIElementRef root, NSString *family, NSString *effort, NSString **bestText) CF_RETURNS_RETAINED {
    NSMutableArray *queue = AXTraversalQueue(root);
    AXUIElementRef best = NULL; NSString *bestLabel = nil; NSString *bestRole = nil; BOOL bestMatchesEffort = NO;
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 50000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        id rawRole = AXRead(element, kAXRoleAttribute); NSString *role = [rawRole isKindOfClass:NSString.class] ? rawRole : @"";
        NSString *label = AXText(element);
        if ((ActionableRole(role) || ClickableMenuText(element, role, label)) && OlympusModelFamilyMatchesLabel(label, family)) {
            NSComparisonResult comparison = bestLabel ? OlympusCompareModelVersions(label, bestLabel, family) : NSOrderedDescending;
            BOOL matchesEffort = LabelMatchesEffort(label, effort);
            BOOL preferEffortOnTie = comparison == NSOrderedSame && matchesEffort && !bestMatchesEffort;
            BOOL sameEffortStatus = matchesEffort == bestMatchesEffort;
            BOOL preferMenuItemOnTie = comparison == NSOrderedSame && sameEffortStatus && ![bestRole isEqualToString:(NSString *)kAXMenuItemRole] && [role isEqualToString:(NSString *)kAXMenuItemRole];
            if (!best || comparison == NSOrderedDescending || preferEffortOnTie || preferMenuItemOnTie) {
                if (best) CFRelease(best);
                best = element; CFRetain(best); bestLabel = label; bestRole = role; bestMatchesEffort = matchesEffort;
            }
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }
    if (bestText) *bestText = bestLabel;
    return best;
}

static AXUIElementRef CopyEffortChoice(AXUIElementRef root, NSString *effort) CF_RETURNS_RETAINED {
    NSArray *aliases = EffortAliases(effort);
    return CopyDescendant(root, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
        if (!ActionableRole(role) && !ClickableMenuText(element, role, label)) return NO;
        NSString *normalized = OlympusNormalizeModelLabel(label);
        for (NSString *alias in aliases) {
            if ([normalized isEqualToString:alias] || [normalized hasPrefix:[alias stringByAppendingString:@" "]] ||
                [normalized isEqualToString:[@"esfuerzo " stringByAppendingString:alias]] || [normalized isEqualToString:[@"effort " stringByAppendingString:alias]]) return YES;
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

static NSInteger EffortRank(NSString *labelOrEffort) {
    NSString *value = OlympusNormalizeModelLabel(labelOrEffort);
    if ([value containsString:@"muy alto"] || [value containsString:@"extra high"] || ContainsWord(value, @"xhigh")) return 3;
    if (ContainsWord(value, @"max") || ContainsWord(value, @"maximo") || ContainsWord(value, @"maximum")) return 4;
    if (ContainsWord(value, @"alto") || ContainsWord(value, @"high")) return 2;
    if (ContainsWord(value, @"medio") || ContainsWord(value, @"medium")) return 1;
    if (ContainsWord(value, @"ligero") || ContainsWord(value, @"bajo") || ContainsWord(value, @"low") || ContainsWord(value, @"light")) return 0;
    return NSNotFound;
}

static BOOL TrySelectCombinedChatGPTEffort(AXUIElementRef control, NSRunningApplication *application, NSString *effort) {
    NSInteger currentRank = EffortRank(AXText(control)), targetRank = EffortRank(effort);
    if (currentRank == NSNotFound || targetRank == NSNotFound) return NO;
    if (currentRank == targetRank) return YES;

    CGRect frame = CGRectZero;
    if (!ReadFrame(control, &frame) || frame.size.width < 40 || frame.size.height < 18) return NO;

    // ChatGPT's current desktop UI opens a five-position reasoning slider from
    // this combined model/effort control. It is visually interactive but does
    // not expose an AXSlider, so use geometry relative to the accessible button.
    BOOL opened = NO;
    NSArray<NSValue *> *menuPoints = @[
        [NSValue valueWithPoint:NSMakePoint(CGRectGetMaxX(frame) - 8.0, CGRectGetMidY(frame))],
        [NSValue valueWithPoint:NSMakePoint(CGRectGetMidX(frame), CGRectGetMidY(frame))]
    ];
    for (NSUInteger attempt = 0; attempt < 4 && !opened; attempt++) {
        CGPoint menuPoint = menuPoints[attempt % menuPoints.count].pointValue;
        ClickPoint(menuPoint); [NSThread sleepForTimeInterval:0.55];
        opened = [OlympusNormalizeModelLabel(AXText(control)) containsString:@"selecciona el esfuerzo"];
        if (!opened) {
            AXUIElementRef appRoot = AXUIElementCreateApplication(application.processIdentifier);
            AXUIElementRef openControl = CopyDescendant(appRoot, ^BOOL(AXUIElementRef element, NSString *role, NSString *label) {
                return [role isEqualToString:(NSString *)kAXPopUpButtonRole] &&
                    [OlympusNormalizeModelLabel(label) containsString:@"selecciona el esfuerzo"];
            });
            opened = openControl != NULL;
            if (openControl) CFRelease(openControl);
            CFRelease(appRoot);
        }
    }
    if (!opened) return NO;

    CGFloat step = (frame.size.width + 30.0) / 4.0;
    CGFloat x = CGRectGetMidX(frame) - 10.0 + ((CGFloat)targetRank - 2.0) * step;
    CGPoint sliderPoint = CGPointMake(x, CGRectGetMinY(frame) - 35.0);
    if (!ClickPoint(sliderPoint)) return NO;
    [NSThread sleepForTimeInterval:0.65];
    PostGlobalKey(53); // Escape closes the popover and restores the resolved label.
    [NSThread sleepForTimeInterval:0.65];
    return YES;
}

static NSString *ResolvedFamilyName(NSString *label, NSString *family) {
    NSString *version = VersionText(label, family);
    NSDictionary *names = @{@"opus": @"Opus", @"sonnet": @"Sonnet", @"astra": @"Astra", @"sol": @"Sol", @"terra": @"Terra", @"luna": @"Luna", @"gpt": @"GPT"};
    NSString *name = names[family] ?: family.capitalizedString;
    if (!version.length) return name;
    if ([@[@"astra", @"sol", @"terra", @"luna"] containsObject:family]) return [NSString stringWithFormat:@"GPT-%@ %@", version, name];
    if ([family isEqualToString:@"gpt"]) return [NSString stringWithFormat:@"GPT-%@", version];
    return [NSString stringWithFormat:@"%@ %@", name, version];
}

static NSRunningApplication *RunningApplicationWithWindow(NSString *bundleIdentifier) {
    NSArray<NSRunningApplication *> *applications = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier];
    for (NSRunningApplication *candidate in applications) {
        AXUIElementRef root = AXUIElementCreateApplication(candidate.processIdentifier);
        id windows = AXRead(root, kAXWindowsAttribute);
        id mainWindow = AXRead(root, kAXMainWindowAttribute);
        id focusedWindow = AXRead(root, kAXFocusedWindowAttribute);
        CFRelease(root);
        if (([windows isKindOfClass:NSArray.class] && [windows count] > 0) || mainWindow || focusedWindow) return candidate;
    }
    return applications.firstObject;
}

BOOL OlympusEnsureModelSelection(NSString *bundleIdentifier, NSDictionary *rawSelection, NSDictionary **resolvedSelection, NSError **error) {
    NSDictionary *selection = NormalizedSelection(bundleIdentifier, rawSelection);
    NSString *model = selection[@"model"], *mode = selection[@"modelMode"], *effort = selection[@"effort"];
    if (!model.length) { if (error) *error = ModelError(1, bundleIdentifier, @"un modelo", mode, effort, @"Configurá el modelo en Olympus."); return NO; }
    NSRunningApplication *application = RunningApplicationWithWindow(bundleIdentifier);
    if (!application) { if (error) *error = ModelError(2, bundleIdentifier, model, mode, effort, @"La aplicación no está abierta."); return NO; }
    if (!AXIsProcessTrusted()) { if (error) *error = ModelError(3, bundleIdentifier, model, mode, effort, @"Falta el permiso de Accesibilidad."); return NO; }
    [application activateWithOptions:NSApplicationActivateAllWindows]; PostEscape(application.processIdentifier); [NSThread sleepForTimeInterval:1.0];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    id activeWindow = AXRead(root, kAXFocusedWindowAttribute) ?: AXRead(root, kAXMainWindowAttribute);
    if (activeWindow) { AXUIElementPerformAction((__bridge AXUIElementRef)activeWindow, kAXRaiseAction); [NSThread sleepForTimeInterval:0.35]; }
    AXUIElementRef control = CopyModelControl(root, selection);
    if (!control) { CFRelease(root); if (error) *error = ModelError(4, bundleIdentifier, model, mode, effort, @"No encontré el selector de modelo."); return NO; }
    NSString *current = AXText(control), *selectedLabel = current;
    BOOL modelCorrect = SelectionMatchesLabel(current, selection, NO);

    BOOL combinedChatGPTControl = [bundleIdentifier isEqualToString:@"com.openai.codex"] && modelCorrect;
    if ([mode isEqualToString:@"family"] && !combinedChatGPTControl) {
        if (!Click(control)) { CFRelease(control); CFRelease(root); if (error) *error = ModelError(5, bundleIdentifier, model, mode, effort, @"No pude abrir el selector."); return NO; }
        CFRelease(control); control = NULL; [NSThread sleepForTimeInterval:0.8];
        NSString *bestLabel = nil; AXUIElementRef modelChoice = CopyBestFamilyChoice(root, model, effort, &bestLabel);
        if (!modelChoice) { CFRelease(root); PostEscape(application.processIdentifier); if (error) *error = ModelError(6, bundleIdentifier, model, mode, effort, @"La familia configurada no está disponible en la aplicación."); return NO; }
        selectedLabel = bestLabel ?: selectedLabel;
        Click(modelChoice); CFRelease(modelChoice); [NSThread sleepForTimeInterval:0.8];
        control = CopyModelControl(root, selection); current = control ? AXText(control) : @"";
        modelCorrect = control && SelectionMatchesLabel(current, selection, NO);
    } else if (!modelCorrect) {
        if (!Click(control)) { CFRelease(control); CFRelease(root); if (error) *error = ModelError(5, bundleIdentifier, model, mode, effort, @"No pude abrir el selector."); return NO; }
        CFRelease(control); control = NULL; [NSThread sleepForTimeInterval:0.8];
        AXUIElementRef modelChoice = CopyExactChoice(root, selection);
        if (modelChoice) { selectedLabel = AXText(modelChoice); Click(modelChoice); CFRelease(modelChoice); [NSThread sleepForTimeInterval:0.8]; }
        control = CopyModelControl(root, selection); current = control ? AXText(control) : @"";
        modelCorrect = control && SelectionMatchesLabel(current, selection, NO);
    }
    if (!modelCorrect) {
        if (control) CFRelease(control); CFRelease(root); PostEscape(application.processIdentifier);
        if (error) *error = ModelError(6, bundleIdentifier, model, mode, effort, @"Olympus no pudo seleccionar el modelo."); return NO;
    }

    if (![effort isEqualToString:@"automatic"] && !SelectionMatchesLabel(current, selection, YES)) {
        if (!control) control = CopyModelControl(root, selection);
        if (control && [bundleIdentifier isEqualToString:@"com.openai.codex"]) {
            BOOL adjusted = TrySelectCombinedChatGPTEffort(control, application, effort);
            if (adjusted) {
                CFRelease(control); control = CopyModelControl(root, selection);
            }
            current = control ? AXText(control) : @"";
        }
    }
    if (![effort isEqualToString:@"automatic"] && !SelectionMatchesLabel(current, selection, YES)) {
        if (!control) control = CopyModelControl(root, selection);
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
    control = CopyModelControl(root, selection); current = control ? AXText(control) : @"";
    BOOL verified = control && SelectionMatchesLabel(current, selection, YES);
    if (verified && resolvedSelection) {
        NSString *application = [bundleIdentifier containsString:@"anthropic"] ? @"claude" : @"chatgpt";
        NSString *resolvedModel = [mode isEqualToString:@"family"] ? ResolvedFamilyName(selectedLabel.length ? selectedLabel : current, model) : model;
        *resolvedSelection = @{@"provider": application, @"requestedModel": model, @"modelMode": mode, @"model": resolvedModel, @"effort": effort};
    }
    if (control) CFRelease(control); CFRelease(root);
    if (!verified) PostEscape(application.processIdentifier);
    if (!verified && error) *error = ModelError(7, bundleIdentifier, model, mode, effort, @"Olympus no pudo confirmar el modelo y el razonamiento seleccionados.");
    return verified;
}
