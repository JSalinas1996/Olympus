#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

@interface OlympusDelegate : NSObject <NSApplicationDelegate>
@property NSWindow *window;
@property NSTextField *permissionValue;
@property NSTextField *claudeValue;
@property NSTextField *chatGPTValue;
@property NSTextField *detailValue;
@property NSTimer *timer;
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
    [self.window setContentSize:NSMakeSize(960, 640)];
    [self.window center];

    NSView *content = self.window.contentView;
    NSView *sidebar = [NSView new];
    sidebar.translatesAutoresizingMaskIntoConstraints = NO;
    sidebar.wantsLayer = YES;
    sidebar.layer.backgroundColor = [NSColor colorWithWhite:0.08 alpha:1].CGColor;

    NSTextField *brand = Label(@"OLYMPUS", 20, NSFontWeightBold);
    brand.textColor = NSColor.whiteColor;
    NSTextField *caption = Label(@"Campus personal", 12, NSFontWeightRegular);
    caption.textColor = [NSColor colorWithWhite:0.65 alpha:1];
    NSButton *home = [NSButton buttonWithTitle:@"⌂  Materias" target:self action:nil];
    home.bordered = NO;
    home.alignment = NSTextAlignmentLeft;
    home.font = [NSFont systemFontOfSize:15 weight:NSFontWeightSemibold];
    home.contentTintColor = NSColor.whiteColor;
    home.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *connection = Label(@"●  Claude y ChatGPT conectados", 12, NSFontWeightMedium);
    connection.textColor = NSColor.systemGreenColor;
    for (NSView *view in @[brand, caption, home, connection]) [sidebar addSubview:view];

    NSTextField *title = Label(@"Mis materias", 30, NSFontWeightBold);
    NSTextField *subtitle = Label(@"Organizá el material y los trabajos prácticos de cada materia.", 14, NSFontWeightRegular);
    subtitle.textColor = NSColor.secondaryLabelColor;
    NSButton *add = [NSButton buttonWithTitle:@"＋ Nueva materia" target:self action:@selector(addSubject:)];
    add.bezelStyle = NSBezelStyleRounded;
    add.controlSize = NSControlSizeLarge;
    add.translatesAutoresizingMaskIntoConstraints = NO;

    NSArray *subjects = [NSUserDefaults.standardUserDefaults arrayForKey:@"OlympusSubjects"] ?: @[];
    NSStackView *list = [NSStackView stackViewWithViews:@[]];
    list.orientation = NSUserInterfaceLayoutOrientationVertical;
    list.alignment = NSLayoutAttributeLeading;
    list.spacing = 12;
    list.translatesAutoresizingMaskIntoConstraints = NO;
    if (subjects.count == 0) {
        NSTextField *emptyTitle = Label(@"Todavía no cargaste materias", 20, NSFontWeightSemibold);
        NSTextField *emptyText = Label(@"Creá la primera para agregar consignas, leyes, material teórico y modelos corregidos.", 14, NSFontWeightRegular);
        emptyText.textColor = NSColor.secondaryLabelColor;
        [list addArrangedSubview:emptyTitle];
        [list addArrangedSubview:emptyText];
    } else {
        for (NSString *subject in subjects) {
            NSButton *button = [NSButton buttonWithTitle:[NSString stringWithFormat:@"  %@                                      Abrir  ›", subject] target:self action:@selector(openSubject:)];
            button.identifier = subject;
            button.bezelStyle = NSBezelStyleRounded;
            button.controlSize = NSControlSizeLarge;
            [button.widthAnchor constraintEqualToConstant:610].active = YES;
            [list addArrangedSubview:button];
        }
    }

    for (NSView *view in @[sidebar, title, subtitle, add, list]) [content addSubview:view];
    [NSLayoutConstraint activateConstraints:@[
        [sidebar.leadingAnchor constraintEqualToAnchor:content.leadingAnchor],
        [sidebar.topAnchor constraintEqualToAnchor:content.topAnchor],
        [sidebar.bottomAnchor constraintEqualToAnchor:content.bottomAnchor],
        [sidebar.widthAnchor constraintEqualToConstant:235],
        [brand.leadingAnchor constraintEqualToAnchor:sidebar.leadingAnchor constant:28],
        [brand.topAnchor constraintEqualToAnchor:sidebar.topAnchor constant:34],
        [caption.leadingAnchor constraintEqualToAnchor:brand.leadingAnchor],
        [caption.topAnchor constraintEqualToAnchor:brand.bottomAnchor constant:2],
        [home.leadingAnchor constraintEqualToAnchor:brand.leadingAnchor],
        [home.trailingAnchor constraintEqualToAnchor:sidebar.trailingAnchor constant:-18],
        [home.topAnchor constraintEqualToAnchor:caption.bottomAnchor constant:38],
        [connection.leadingAnchor constraintEqualToAnchor:brand.leadingAnchor],
        [connection.bottomAnchor constraintEqualToAnchor:sidebar.bottomAnchor constant:-28],
        [title.leadingAnchor constraintEqualToAnchor:sidebar.trailingAnchor constant:42],
        [title.topAnchor constraintEqualToAnchor:content.topAnchor constant:42],
        [subtitle.leadingAnchor constraintEqualToAnchor:title.leadingAnchor],
        [subtitle.topAnchor constraintEqualToAnchor:title.bottomAnchor constant:8],
        [add.trailingAnchor constraintEqualToAnchor:content.trailingAnchor constant:-42],
        [add.centerYAnchor constraintEqualToAnchor:title.centerYAnchor],
        [list.leadingAnchor constraintEqualToAnchor:title.leadingAnchor],
        [list.topAnchor constraintEqualToAnchor:subtitle.bottomAnchor constant:42]
    ]];
}

- (void)addSubject:(id)sender {
    NSAlert *alert = [NSAlert new];
    alert.messageText = @"Nueva materia";
    alert.informativeText = @"Escribí el nombre tal como aparece en tu carrera.";
    [alert addButtonWithTitle:@"Crear materia"];
    [alert addButtonWithTitle:@"Cancelar"];
    NSTextField *input = [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 360, 28)];
    input.placeholderString = @"Ej.: Personas Jurídicas";
    alert.accessoryView = input;
    if ([alert runModal] != NSAlertFirstButtonReturn) return;
    NSString *name = [input.stringValue stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (name.length == 0) return;
    NSMutableArray *subjects = [[NSUserDefaults.standardUserDefaults arrayForKey:@"OlympusSubjects"] mutableCopy] ?: [NSMutableArray array];
    [subjects addObject:name];
    [NSUserDefaults.standardUserDefaults setObject:subjects forKey:@"OlympusSubjects"];
    [self showDashboard];
}

- (void)openSubject:(NSButton *)sender {
    NSAlert *alert = [NSAlert new];
    alert.messageText = sender.identifier ?: @"Materia";
    alert.informativeText = @"La materia quedó creada. El siguiente módulo incorporará documentos, prompts, trabajos y devoluciones en esta pantalla.";
    [alert addButtonWithTitle:@"Entendido"];
    [alert runModal];
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
