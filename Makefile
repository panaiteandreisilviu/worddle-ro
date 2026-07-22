# Wordle RO — Tauri 2 / web helpers
#
#   make web            Browser (port 8765)
#   make web PORT=3000  Custom port
#   make mac            Tauri desktop (macOS)
#   make build-mac      Release build (macOS)
#   make android-init   Generate Android project (once)
#   make android        Run on emulator/device
#   make android-build-dev   Debug APK (sideload / testing)
#   make android-build-prod  Release APK (production)
#   make icon                Regenerate app icons from app-icon.png

PORT ?= 8765
URL  := http://127.0.0.1:$(PORT)

# Absolute tool paths — macOS /usr/bin/make does not reliably inherit Makefile PATH exports
NODE_BIN  := /opt/homebrew/opt/node/bin
CARGO_BIN := $(HOME)/.cargo/bin
BREW_BIN  := /opt/homebrew/bin
NPM       := $(NODE_BIN)/npm

ANDROID_HOME ?= $(HOME)/Library/Android/sdk
ANDROID_SDK_ROOT ?= $(ANDROID_HOME)
JAVA_HOME ?= /opt/homebrew/opt/openjdk@17
ANDROID_NDK_HOME ?= $(shell ls -1d $(ANDROID_HOME)/ndk/* 2>/dev/null | sort -V | tail -1)

APK_DEV  := $(CURDIR)/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk
APK_PROD := $(CURDIR)/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release.apk
APK_PROD_UNSIGNED := $(CURDIR)/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release-unsigned.apk

# Env for every npm/tauri recipe (use $$PATH so the shell expands it)
RUN = env \
	PATH="$(NODE_BIN):$(BREW_BIN):$(CARGO_BIN):$(JAVA_HOME)/bin:$(ANDROID_HOME)/platform-tools:$(ANDROID_HOME)/emulator:$$PATH" \
	ANDROID_HOME="$(ANDROID_HOME)" \
	ANDROID_SDK_ROOT="$(ANDROID_SDK_ROOT)" \
	ANDROID_NDK_HOME="$(ANDROID_NDK_HOME)" \
	JAVA_HOME="$(JAVA_HOME)"

.PHONY: help web mac desktop dev build-mac build android-init android android-dev android-build android-build-dev android-build-prod icon

help:
	@echo "Wordle RO targets:"
	@echo "  make web [PORT=8765]     Static web server + open browser"
	@echo "  make mac                 Tauri desktop app (macOS)"
	@echo "  make build-mac           Release build for macOS"
	@echo "  make android-init        One-time Android project generation"
	@echo "  make android             Live reload on emulator/device (needs Vite)"
	@echo "  make android-build-dev   Debug APK (no server)"
	@echo "  make android-build-prod  Release APK (no server)"
	@echo "  make icon                Regenerate icons from app-icon.png"
	@echo ""
	@echo "Requires: Node, Rust, Android SDK/NDK (for Android), Java 17"
	@echo "npm: $(NPM)"

web:
	@echo "Wordle RO (web) → $(URL)"
	@(sleep 0.4 && open "$(URL)") &
	python3 -m http.server $(PORT)

mac desktop dev:
	@echo "Wordle RO (macOS) → tauri dev"
	$(RUN) $(NPM) run tauri:dev

build-mac build:
	@echo "Wordle RO → tauri build (macOS)"
	$(RUN) $(NPM) run tauri:build

android-init:
	@echo "Initializing Android project…"
	$(RUN) $(NPM) run android:init

android android-dev:
	@echo "Wordle RO (Android) → tauri android dev"
	$(RUN) $(NPM) run android:dev

# Alias kept for convenience → debug
android-build: android-build-dev

android-build-dev:
	@echo "Wordle RO → Android debug APK"
	$(RUN) $(NPM) run android:build -- --debug --apk --split-per-abi --ci -t aarch64 $(ARGS)
	@echo ""
	@echo "Install it using adb using this command:"
	@echo "  adb install -r \"$(APK_DEV)\""

android-build-prod:
	@echo "Wordle RO → Android release APK"
	$(RUN) $(NPM) run android:build -- --apk --split-per-abi --ci -t aarch64 $(ARGS)
	@echo ""
	@echo "Install it using adb using this command:"
	@if [ -f "$(APK_PROD)" ]; then \
		echo "  adb install -r \"$(APK_PROD)\""; \
	elif [ -f "$(APK_PROD_UNSIGNED)" ]; then \
		echo "  adb install -r \"$(APK_PROD_UNSIGNED)\""; \
	else \
		echo "  (APK not found — check Gradle output above for the path)"; \
		ls -la "$(CURDIR)/src-tauri/gen/android/app/build/outputs/apk/arm64/release/" 2>/dev/null || true; \
	fi

icon:
	$(RUN) $(NPM) run tauri -- icon app-icon.png
	cp app-icon.png public/icon.png
	cp src-tauri/icons/128x128.png public/favicon.png
