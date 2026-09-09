#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <WebKit/WebKit.h>

@interface OlympusDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler>
@property NSWindow *window;
@property NSTextField *permissionValue;
@property NSTextField *claudeValue;
@property NSTextField *chatGPTValue;
@property NSTextField *detailValue;
@property NSTimer *timer;
@property WKWebView *webView;
@property NSTask *backendTask;
@end

static id AXRead(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess) return nil;
    return CFBridgingRelease(value);
}

static NSUInteger EditableControlCount(NSString *bundleIdentifier) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application || !AXIsProcessTrusted()) return 0;
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root];
    NSUInteger count = 0;
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 4000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        Boolean settable = false;
        if (AXUIElementIsAttributeSettable(element, kAXValueAttribute, &settable) == kAXErrorSuccess && settable) count++;
        id children = AXRead(element, kAXChildrenAttribute);
        if ([children isKindOfClass:NSArray.class]) [queue addObjectsFromArray:children];
    }
    CFRelease(root);
    return count;
}

static BOOL SendPromptToApplication(NSString *bundleIdentifier, NSString *prompt) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application || !AXIsProcessTrusted() || prompt.length == 0) return NO;
    [application activateWithOptions:NSApplicationActivateIgnoringOtherApps];
    [NSThread sleepForTimeInterval:1.2];
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root];
    AXUIElementRef target = NULL;
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 5000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        Boolean settable = false;
        id role = AXRead(element, kAXRoleAttribute);
        if (([role isEqual:(__bridge NSString *)kAXTextAreaRole] || [role isEqual:(__bridge NSString *)kAXTextFieldRole]) && AXUIElementIsAttributeSettable(element, kAXValueAttribute, &settable) == kAXErrorSuccess && settable) target = element;
        id children = AXRead(element, kAXChildrenAttribute);
        if ([children isKindOfClass:NSArray.class]) [queue addObjectsFromArray:children];
    }
    BOOL sent = NO;
    if (target) {
        AXUIElementSetAttributeValue(target, kAXFocusedAttribute, kCFBooleanTrue);
        if (AXUIElementSetAttributeValue(target, kAXValueAttribute, (__bridge CFTypeRef)prompt) == kAXErrorSuccess) {
            CGEventRef down = CGEventCreateKeyboardEvent(NULL, 36, true);
            CGEventRef up = CGEventCreateKeyboardEvent(NULL, 36, false);
            CGEventPost(kCGHIDEventTap, down); CGEventPost(kCGHIDEventTap, up);
            CFRelease(down); CFRelease(up); sent = YES;
        }
    }
    CFRelease(root);
    return sent;
}

static NSString *LargestResponseText(NSString *bundleIdentifier, NSString *sentPrompt) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationsWithBundleIdentifier:bundleIdentifier].firstObject;
    if (!application || !AXIsProcessTrusted()) return @"";
    AXUIElementRef root = AXUIElementCreateApplication(application.processIdentifier);
    NSMutableArray *queue = [NSMutableArray arrayWithObject:(__bridge id)root];
    NSString *best = @"";
    for (NSUInteger cursor = 0; cursor < queue.count && cursor < 7000; cursor++) {
        AXUIElementRef element = (__bridge AXUIElementRef)queue[cursor];
        id value = AXRead(element, kAXValueAttribute);
        if ([value isKindOfClass:NSString.class]) {
            NSString *text = [(NSString *)value stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
            if (text.length > best.length && text.length > 150 && ![text isEqualToString:sentPrompt]) best = text;
        }
        id children = AXRead(element, kAXChildrenAttribute);
        if ([children isKindOfClass:NSArray.class]) [queue addObjectsFromArray:children];
    }
    CFRelease(root);
    return best;
}

static NSString *WaitForResponse(NSString *bundleIdentifier, NSString *sentPrompt, NSTimeInterval timeout) {
    NSString *previous = @""; NSUInteger stable = 0;
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeout];
    while ([deadline timeIntervalSinceNow] > 0) {
        [NSThread sleepForTimeInterval:5];
        NSString *candidate = LargestResponseText(bundleIdentifier, sentPrompt);
        if (candidate.length > 150 && [candidate isEqualToString:previous]) stable++; else stable = 0;
        previous = candidate;
        if (stable >= 2) return candidate;
    }
    return previous;
}

static NSString *JSONStringLiteral(NSString *value) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:@[value ?: @""] options:0 error:nil];
    NSString *array = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    return array.length >= 2 ? [array substringWithRange:NSMakeRange(1, array.length - 2)] : @"\"\"";
}

static NSTextField *Label(NSString *text, CGFloat size, NSFontWeight weight) {
    NSTextField *label = [NSTextField labelWithString:text];
    label.font = [NSFont systemFontOfSize:size weight:weight];
    label.textColor = NSColor.labelColor;
    label.translatesAutoresizingMaskIntoConstraints = NO;
    return label;
}

static NSView *StatusRow(NSString *name, NSTextField **valuePointer) {
    NSView *row = [NSView new];
    row.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *nameLabel = Label(name, 15, NSFontWeightSemibold);
    NSTextField *value = Label(@"Comprobando…", 14, NSFontWeightRegular);
    value.textColor = NSColor.secondaryLabelColor;
    [row addSubview:nameLabel];
    [row addSubview:value];
    [NSLayoutConstraint activateConstraints:@[
        [nameLabel.leadingAnchor constraintEqualToAnchor:row.leadingAnchor constant:18],
        [nameLabel.centerYAnchor constraintEqualToAnchor:row.centerYAnchor],
        [value.trailingAnchor constraintEqualToAnchor:row.trailingAnchor constant:-18],
        [value.centerYAnchor constraintEqualToAnchor:row.centerYAnchor],
        [row.heightAnchor constraintEqualToConstant:50]
    ]];
    *valuePointer = value;
    return row;
}

static NSBox *Separator(void) {
    NSBox *box = [NSBox new];
    box.boxType = NSBoxSeparator;
    return box;
}

@implementation OlympusDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 620, 520)
                                              styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable
                                                backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"Olympus — Conexión con IA";
    [self.window center];

    NSView *content = self.window.contentView;
    content.wantsLayer = YES;
    content.layer.backgroundColor = NSColor.windowBackgroundColor.CGColor;

    if (AXIsProcessTrusted()) {
        [self showDashboard];
        [self.window makeKeyAndOrderFront:nil];
        [NSApp activateIgnoringOtherApps:YES];
        return;
    }

    NSTextField *title = Label(@"Preparar Claude y ChatGPT", 27, NSFontWeightBold);
    NSTextField *subtitle = Label(@"Olympus usará las aplicaciones nativas abiertas en esta Mac y tus sesiones actuales.", 14, NSFontWeightRegular);
    subtitle.textColor = NSColor.secondaryLabelColor;
    subtitle.maximumNumberOfLines = 2;

    NSStackView *card = [NSStackView stackViewWithViews:@[]];
    card.orientation = NSUserInterfaceLayoutOrientationVertical;
    card.spacing = 0;
    card.translatesAutoresizingMaskIntoConstraints = NO;
    card.wantsLayer = YES;
    card.layer.cornerRadius = 12;
    card.layer.backgroundColor = NSColor.controlBackgroundColor.CGColor;

    NSTextField *permissionValue;
    NSTextField *claudeValue;
    NSTextField *chatGPTValue;
    [card addArrangedSubview:StatusRow(@"Permiso de Accesibilidad", &permissionValue)];
    [card addArrangedSubview:Separator()];
    [card addArrangedSubview:StatusRow(@"Claude", &claudeValue)];
    [card addArrangedSubview:Separator()];
    [card addArrangedSubview:StatusRow(@"ChatGPT", &chatGPTValue)];
    self.permissionValue = permissionValue;
    self.claudeValue = claudeValue;
    self.chatGPTValue = chatGPTValue;

    self.detailValue = Label(@"", 13, NSFontWeightRegular);
    self.detailValue.textColor = NSColor.secondaryLabelColor;
    self.detailValue.maximumNumberOfLines = 3;

    NSButton *permissionButton = [NSButton buttonWithTitle:@"Habilitar Accesibilidad" target:self action:@selector(requestPermission:)];
    permissionButton.bezelStyle = NSBezelStyleRounded;
    permissionButton.controlSize = NSControlSizeLarge;
    permissionButton.translatesAutoresizingMaskIntoConstraints = NO;

    NSButton *refreshButton = [NSButton buttonWithTitle:@"Volver a comprobar" target:self action:@selector(refresh:)];
    refreshButton.bezelStyle = NSBezelStyleRounded;
    refreshButton.controlSize = NSControlSizeLarge;
    refreshButton.translatesAutoresizingMaskIntoConstraints = NO;

    NSStackView *buttons = [NSStackView stackViewWithViews:@[permissionButton, refreshButton]];
    buttons.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    buttons.spacing = 10;
    buttons.translatesAutoresizingMaskIntoConstraints = NO;

    for (NSView *view in @[title, subtitle, card, self.detailValue, buttons]) [content addSubview:view];
    [NSLayoutConstraint activateConstraints:@[
        [title.leadingAnchor constraintEqualToAnchor:content.leadingAnchor constant:42],
        [title.trailingAnchor constraintEqualToAnchor:content.trailingAnchor constant:-42],
        [title.topAnchor constraintEqualToAnchor:content.topAnchor constant:42],
        [subtitle.leadingAnchor constraintEqualToAnchor:title.leadingAnchor],
        [subtitle.trailingAnchor constraintEqualToAnchor:title.trailingAnchor],
        [subtitle.topAnchor constraintEqualToAnchor:title.bottomAnchor constant:10],
        [card.leadingAnchor constraintEqualToAnchor:title.leadingAnchor],
        [card.trailingAnchor constraintEqualToAnchor:title.trailingAnchor],
        [card.topAnchor constraintEqualToAnchor:subtitle.bottomAnchor constant:28],
        [self.detailValue.leadingAnchor constraintEqualToAnchor:title.leadingAnchor],
        [self.detailValue.trailingAnchor constraintEqualToAnchor:title.trailingAnchor],
        [self.detailValue.topAnchor constraintEqualToAnchor:card.bottomAnchor constant:22],
        [buttons.leadingAnchor constraintEqualToAnchor:title.leadingAnchor],
        [buttons.bottomAnchor constraintEqualToAnchor:content.bottomAnchor constant:-38]
    ]];

    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
    [self refresh:nil];
    self.timer = [NSTimer scheduledTimerWithTimeInterval:2 target:self selector:@selector(refresh:) userInfo:nil repeats:YES];
}

- (void)showDashboard {
    [self.timer invalidate];
    for (NSView *view in self.window.contentView.subviews.copy) [view removeFromSuperview];
    self.window.title = @"Olympus";
    [self.window setContentSize:NSMakeSize(1180, 760)];
    [self.window center];
    [self startBackend];
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    [configuration.userContentController addScriptMessageHandler:self name:@"olympus"];
    NSString *bridge = @"window.__OLYMPUS_NATIVE__=true;window.dispatchEvent(new Event('olympus-native-ready'));";
    [configuration.userContentController addUserScript:[[WKUserScript alloc] initWithSource:bridge injectionTime:WKUserScriptInjectionTimeAtDocumentEnd forMainFrameOnly:YES]];
    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    [self.window.contentView addSubview:self.webView];
    [NSLayoutConstraint activateConstraints:@[
        [self.webView.leadingAnchor constraintEqualToAnchor:self.window.contentView.leadingAnchor],
        [self.webView.trailingAnchor constraintEqualToAnchor:self.window.contentView.trailingAnchor],
        [self.webView.topAnchor constraintEqualToAnchor:self.window.contentView.topAnchor],
        [self.webView.bottomAnchor constraintEqualToAnchor:self.window.contentView.bottomAnchor]
    ]];
    [self loadCampus];
}

- (void)startBackend {
    if (self.backendTask.running) return;
    self.backendTask = [NSTask new];
    self.backendTask.executableURL = [NSURL fileURLWithPath:@"/Users/joaquin/.nvm/versions/node/v24.15.0/bin/npm"];
    self.backendTask.currentDirectoryURL = [NSURL fileURLWithPath:@"/Users/joaquin/Documents/ChatGPT/Olympus/web"];
    self.backendTask.arguments = @[@"run", @"dev", @"--", @"--port", @"43127"];
    NSMutableDictionary *environment = NSProcessInfo.processInfo.environment.mutableCopy;
    environment[@"PATH"] = [@"/Users/joaquin/.nvm/versions/node/v24.15.0/bin:" stringByAppendingString:environment[@"PATH"] ?: @""];
    self.backendTask.environment = environment;
    NSString *logPath = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Logs/Olympus Campus.log"];
    [[NSFileManager defaultManager] createFileAtPath:logPath contents:nil attributes:nil];
    NSFileHandle *log = [NSFileHandle fileHandleForWritingAtPath:logPath];
    self.backendTask.standardOutput = log;
    self.backendTask.standardError = log;
    NSError *error;
    if (![self.backendTask launchAndReturnError:&error]) NSLog(@"No se pudo iniciar Olympus: %@", error);
}

- (void)loadCampus {
    [self.webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:@"http://127.0.0.1:43127"] cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:10]];
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    [self performSelector:@selector(loadCampus) withObject:nil afterDelay:2];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    [webView evaluateJavaScript:@"window.__OLYMPUS_NATIVE__=true;window.dispatchEvent(new Event('olympus-native-ready'));" completionHandler:nil];
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.body isKindOfClass:NSDictionary.class]) return;
    NSDictionary *payload = message.body;
    if ([payload[@"action"] isEqual:@"open-ai-apps"]) {
        [[NSWorkspace sharedWorkspace] launchApplicationAtURL:[NSURL fileURLWithPath:@"/Applications/Claude.app"] options:NSWorkspaceLaunchDefault configuration:@{} error:nil];
        NSURL *chatGPT = [[NSWorkspace sharedWorkspace] URLForApplicationWithBundleIdentifier:@"com.openai.codex"];
        if (chatGPT) [[NSWorkspace sharedWorkspace] launchApplicationAtURL:chatGPT options:NSWorkspaceLaunchDefault configuration:@{} error:nil];
    } else if ([payload[@"action"] isEqual:@"start-cycle"] && [payload[@"prompt"] isKindOfClass:NSString.class]) {
        NSString *prompt = payload[@"prompt"];
        NSString *professorPrompt = [payload[@"professorPrompt"] isKindOfClass:NSString.class] ? payload[@"professorPrompt"] : @"Corregí como catedrático.";
        dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
            BOOL sent = SendPromptToApplication(@"com.anthropic.claudefordesktop", prompt);
            NSString *draft = sent ? WaitForResponse(@"com.anthropic.claudefordesktop", prompt, 240) : @"";
            NSString *evaluationPrompt = [NSString stringWithFormat:@"%@\n\nEvaluá este trabajo como catedrático sobre 10. Verificá las afirmaciones y citas, contrastá las consignas y la rúbrica, y enumerá cambios concretos. Cerrá con 'CALIFICACIÓN: X/10'.\n\nTRABAJO DE CLAUDE:\n%@", professorPrompt, draft];
            BOOL evaluated = draft.length > 0 && SendPromptToApplication(@"com.openai.codex", evaluationPrompt);
            NSString *evaluation = evaluated ? WaitForResponse(@"com.openai.codex", evaluationPrompt, 240) : @"";
            dispatch_async(dispatch_get_main_queue(), ^{
                NSString *status = evaluation.length > 0 ? @"Claude redactó el trabajo y ChatGPT completó la primera corrección." : (sent ? @"Claude recibió el trabajo, pero no pude leer una respuesta completa." : @"No encontré el cuadro de texto de Claude. Abrí un chat nuevo y volvé a iniciar.");
                NSString *script = [NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('olympus-cycle-result',{detail:{status:%@,draft:%@,evaluation:%@}}))", JSONStringLiteral(status), JSONStringLiteral(draft), JSONStringLiteral(evaluation)];
                [self.webView evaluateJavaScript:script completionHandler:nil];
                [self.window makeKeyAndOrderFront:nil];
                [NSApp activateIgnoringOtherApps:YES];
            });
        });
    }
}

- (void)applicationWillTerminate:(NSNotification *)notification {
    if (self.backendTask.running) [self.backendTask terminate];
}

- (void)requestPermission:(id)sender {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES};
    AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
    self.detailValue.stringValue = @"En Ajustes del Sistema, activá Olympus. La pantalla se actualizará automáticamente.";
}

- (void)refresh:(id)sender {
    BOOL trusted = AXIsProcessTrusted();
    BOOL claudeRunning = [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.anthropic.claudefordesktop"].count > 0;
    BOOL chatGPTRunning = [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.openai.codex"].count > 0;
    self.permissionValue.stringValue = trusted ? @"Habilitado ✓" : @"Pendiente";
    self.permissionValue.textColor = trusted ? NSColor.systemGreenColor : NSColor.systemOrangeColor;
    NSUInteger claudeControls = trusted ? EditableControlCount(@"com.anthropic.claudefordesktop") : 0;
    NSUInteger chatGPTControls = trusted ? EditableControlCount(@"com.openai.codex") : 0;
    self.claudeValue.stringValue = claudeRunning ? (trusted ? [NSString stringWithFormat:@"Listo · %lu campos", (unsigned long)claudeControls] : @"Abierto ✓") : @"No está abierto";
    self.claudeValue.textColor = claudeRunning ? NSColor.systemGreenColor : NSColor.systemOrangeColor;
    self.chatGPTValue.stringValue = chatGPTRunning ? (trusted ? [NSString stringWithFormat:@"Listo · %lu campos", (unsigned long)chatGPTControls] : @"Abierto ✓") : @"No está abierto";
    self.chatGPTValue.textColor = chatGPTRunning ? NSColor.systemGreenColor : NSColor.systemOrangeColor;
    if (trusted && claudeRunning && chatGPTRunning && claudeControls > 0 && chatGPTControls > 0) {
        self.detailValue.stringValue = @"Los cuadros de texto de ambas aplicaciones son accesibles. Todo listo para la prueba controlada.";
    } else if (trusted && claudeRunning && chatGPTRunning) {
        self.detailValue.stringValue = @"Las aplicaciones están abiertas, pero alguna no expone un cuadro de texto. Abrí un chat nuevo en cada una.";
    } else if (!trusted) {
        self.detailValue.stringValue = @"Olympus necesita Accesibilidad para encontrar los cuadros de texto y botones de ambas aplicaciones.";
    } else {
        self.detailValue.stringValue = @"Abrí las aplicaciones que figuran pendientes e iniciá sesión con tus suscripciones.";
    }
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return YES; }

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        OlympusDelegate *delegate = [OlympusDelegate new];
        application.delegate = delegate;
        [application run];
    }
    return 0;
}
