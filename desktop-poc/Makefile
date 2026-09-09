BIN := .build/olympus-native-probe
SRC := Sources/main.m
APP := .build/Olympus.app
APP_BIN := $(APP)/Contents/MacOS/Olympus
APP_SRC := App/main.m
EXTRACTOR := .build/olympus-document-extractor

.PHONY: build probe app open clean

build:
	mkdir -p .build
	clang -fobjc-arc -framework AppKit -framework ApplicationServices $(SRC) -o $(BIN)

probe: build
	$(BIN) > probe-report.json

app:
	mkdir -p $(APP)/Contents/MacOS
	clang -fobjc-arc -framework AppKit -framework PDFKit Tools/DocumentExtractor.m -o $(EXTRACTOR)
	cp App/Info.plist $(APP)/Contents/Info.plist
	clang -fobjc-arc -framework AppKit -framework ApplicationServices -framework WebKit $(APP_SRC) -o $(APP_BIN)
	xattr -cr $(APP)
	codesign --force --sign - --identifier com.joaquinsalinas.olympus $(APP)
	codesign --verify --deep --strict $(APP)

install: app
	mkdir -p $(HOME)/Applications
	ditto $(APP) "$(HOME)/Applications/Olympus Campus.app"

open: app
	open $(APP)

clean:
	rm -rf .build probe-report.json
