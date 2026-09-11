BIN := .build/olympus-native-probe
SRC := Sources/main.m
APP := /tmp/OlympusCampusBuild.app
APP_BIN := $(APP)/Contents/MacOS/Olympus
APP_SOURCES := App/main.m App/AIApplication.m App/FileCycle.m App/CycleCoordinator.m
EXTRACTOR := .build/olympus-document-extractor

.PHONY: build probe app test open clean

build:
	mkdir -p .build
	clang -fobjc-arc -framework AppKit -framework ApplicationServices $(SRC) -o $(BIN)

probe: build
	$(BIN) > probe-report.json

app:
	rm -rf $(APP)
	mkdir -p .build
	mkdir -p $(APP)/Contents/MacOS
	clang -fobjc-arc -framework AppKit -framework PDFKit Tools/DocumentExtractor.m -o $(EXTRACTOR)
	cp App/Info.plist $(APP)/Contents/Info.plist
	clang -fobjc-arc -fblocks -framework AppKit -framework ApplicationServices -framework WebKit $(APP_SOURCES) -o $(APP_BIN)
	xattr -cr $(APP)
	codesign --force --sign - --identifier com.joaquinsalinas.olympus $(APP)
	codesign --verify --deep --strict $(APP)

install: app
	mkdir -p $(HOME)/Applications
	ditto $(APP) "$(HOME)/Applications/Olympus Campus.app"

test:
	mkdir -p .build
	clang -fobjc-arc -fblocks -framework AppKit -framework ApplicationServices Tests/FileCycleTests.m App/AIApplication.m App/FileCycle.m App/CycleCoordinator.m -o .build/file-cycle-tests
	.build/file-cycle-tests

open: app
	open $(APP)

clean:
	rm -rf .build probe-report.json
