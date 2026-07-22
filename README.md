# Wordle RO (Tauri 2)

Romanian Wordle — static web frontend wrapped with **Tauri 2** for **macOS** and **Android**.

## Prerequisites

| Tool | Notes |
|------|--------|
| Node.js 20+ | `/opt/homebrew/opt/node` or any current Node |
| Rust (stable) | `curl https://sh.rustup.rs -sSf \| sh` |
| Android SDK + NDK | Android Studio; set `ANDROID_HOME` |
| Java 17 | e.g. `brew install openjdk@17` |

Android Rust targets (once):

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## Setup

```bash
npm install
# first time only, for Android:
make android-init
```

## Run

```bash
# Browser (no Tauri)
make web
# make web PORT=3000

# macOS desktop
make mac

# Android emulator or USB device
make android
```

## Build

```bash
make build-mac
make android-build
```

macOS app: `src-tauri/target/release/bundle/`  
Android APK: under `src-tauri/gen/android/app/build/outputs/`

## Project layout

- `index.html`, `css/`, `js/` — UI
- `public/ro_RO/` — word lists (copied into builds)
- `src-tauri/` — Rust / Tauri backend
- `src-tauri/gen/android/` — generated after `android-init`
