#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

static id AXCopy(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess) return nil;
    return CFBridgingRelease(value);
}

static NSString *AXString(AXUIElementRef element, CFStringRef attribute) {
    id value = AXCopy(element, attribute);
    return [value isKindOfClass:NSString.class] ? value : nil;
}

static NSArray *AXChildren(AXUIElementRef element) {
    id value = AXCopy(element, kAXChildrenAttribute);
    return [value isKindOfClass:NSArray.class] ? value : @[];
}

static BOOL AXEditable(AXUIElementRef element) {
    Boolean settable = false;
    return AXUIElementIsAttributeSettable(element, kAXValueAttribute, &settable) == kAXErrorSuccess && settable;
}

static NSString *AXSafeLabel(AXUIElementRef element) {
    NSArray *attributes = @[(__bridge NSString *)kAXDescriptionAttribute,
                            (__bridge NSString *)kAXTitleAttribute,
                            (__bridge NSString *)kAXHelpAttribute,
                            (__bridge NSString *)kAXIdentifierAttribute];
    for (NSString *attribute in attributes) {
        NSString *value = [AXString(element, (__bridge CFStringRef)attribute) stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
        if (value.length > 0) return [value substringToIndex:MIN(value.length, 120)];
    }
    return nil;
}

static NSDictionary *InspectWindow(AXUIElementRef window) {
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)window];
    NSMutableOrderedSet *labels = [NSMutableOrderedSet orderedSet];
    NSUInteger cursor = 0;
    NSUInteger editableCount = 0;

    while (cursor < queue.count && cursor < 2500) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor++];
        NSString *role = AXString(element, kAXRoleAttribute) ?: @"";
        if ([role isEqualToString:(__bridge NSString *)kAXTextAreaRole] ||
            [role isEqualToString:(__bridge NSString *)kAXTextFieldRole] || AXEditable(element)) {
            editableCount++;
            NSString *label = AXSafeLabel(element);
            if (label) [labels addObject:label];
        }
        [queue addObjectsFromArray:AXChildren(element)];
    }

    return @{ @"title": AXString(window, kAXTitleAttribute) ?: @"",
              @"editableControlCount": @(editableCount),
              @"controlLabels": labels.array };
}

static NSDictionary *InspectApplication(NSString *name, NSString *bundleIdentifier, BOOL trusted) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application) {
        return @{ @"name": name, @"bundleIdentifier": bundleIdentifier, @"running": @NO,
                  @"accessibilityStatus": @"not-running", @"windows": @[] };
    }

    NSMutableArray *windows = [NSMutableArray array];
    NSString *status = trusted ? @"available" : @"permission-required";
    if (trusted) {
        AXUIElementRef appElement = AXUIElementCreateApplication(application.processIdentifier);
        id rawWindows = AXCopy(appElement, kAXWindowsAttribute);
        if ([rawWindows isKindOfClass:NSArray.class]) {
            for (id window in rawWindows) [windows addObject:InspectWindow((__bridge AXUIElementRef)window)];
        } else {
            status = @"windows-unavailable";
        }
        CFRelease(appElement);
    }

    return @{ @"name": name, @"bundleIdentifier": bundleIdentifier, @"running": @YES,
              @"processIdentifier": @(application.processIdentifier), @"accessibilityStatus": status,
              @"windows": windows };
}

int main(void) {
    @autoreleasepool {
        BOOL trusted = AXIsProcessTrusted();
        NSArray *applications = @[
            InspectApplication(@"Claude", @"com.anthropic.claudefordesktop", trusted),
            InspectApplication(@"ChatGPT", @"com.openai.codex", trusted)
        ];
        NSISO8601DateFormatter *formatter = [NSISO8601DateFormatter new];
        NSDictionary *report = @{ @"generatedAt": [formatter stringFromDate:[NSDate date]],
                                  @"accessibilityPermissionGranted": @(trusted),
                                  @"applications": applications };
        NSData *json = [NSJSONSerialization dataWithJSONObject:report options:NSJSONWritingPrettyPrinted error:nil];
        fwrite(json.bytes, 1, json.length, stdout);
        fputc('\n', stdout);
        return 0;
    }
}
