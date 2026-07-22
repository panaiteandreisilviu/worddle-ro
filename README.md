# Wordle RO

Romanian Wordle — web UI wrapped with **Tauri 2** for **macOS** and **Android**.

## Features

- 3–12 letter words, difficulty tiers (easy / medium / hard / all)
- Custom word mode (**Propriu**)
- Optional Romanian diacritics (ă, â, î, ș, ț) with multi-color tile feedback
- In-app word list browser
- Portrait fullscreen on Android

## Prerequisites

| Tool | Notes |
|------|--------|
| Node.js 20+ | e.g. Homebrew `node` |
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

- macOS app: `src-tauri/target/release/bundle/`
- Android APK: `src-tauri/gen/android/app/build/outputs/`

## Project layout

- `index.html`, `css/`, `js/` — game UI
- `public/ro_RO/` — word lists served by the app (Vite public assets)
- `ro_RO/` — same word lists at repo root (regular folder, kept in sync for scripts/local use)
- `ro_stardict/` — Romanian StarDict dictionary data (from [dexonline-stardict](https://github.com/cosminadrianpopescu/dexonline-stardict))
- `src-tauri/` — Rust / Tauri backend
- `src-tauri/gen/android/` — Android project (after `android-init`)

## Credits

- Word frequency splitting: see `scripts/split_by_frequency.py`
- StarDict DEX data: [cosminadrianpopescu/dexonline-stardict](https://github.com/cosminadrianpopescu/dexonline-stardict)
