BIN := .build/olympus-native-probe
SRC := Sources/main.m
APP := .build/Olympus.app
APP_BIN := $(APP)/Contents/MacOS/Olympus
APP_SRC := App/main.m

.PHONY: build probe app open clean

build:
	mkdir -p .build
	clang -fobjc-arc -framework AppKit -framework ApplicationServices $(SRC) -o $(BIN)

probe: build
	$(BIN) > probe-report.json

app:
	mkdir -p $(APP)/Contents/MacOS
	cp App/Info.plist $(APP)/Contents/Info.plist
	clang -fobjc-arc -framework AppKit -framework ApplicationServices $(APP_SRC) -o $(APP_BIN)

open: app
	open $(APP)

clean:
	rm -rf .build probe-report.json
