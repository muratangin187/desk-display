# Desk Display

An always-on, fullscreen Android WebView kiosk app designed for a landscape desk tablet.

## Features

- **Always-On & Clean Fullscreen**: Sticky immersive mode (no status bar, navigation bar, or toolbars) with `FLAG_KEEP_SCREEN_ON` and `sensorLandscape` orientation.
- **Swipe Navigation**: Smooth horizontal swipe between 3 views:
  1. **Markets (Piyasalar)**: Live USD/TRY, EUR/TRY, Gram Altın (TRY), and BIST 100 (`XU100.IS`) cards with daily change, plus an interactive weekly/monthly chart. Touching or dragging on the chart inspects any day's value and its change to today.
  2. **Photo Frame**: Fullscreen landscape slideshow with tap-to-toggle bottom-left Play/Pause button and configurable intervals (`30s`, `1m`, `5m`, `15m`).
  3. **Hacker News**: Clean front-page reader with built-in article reader, comments view, and in-app browser fallback.
- **Native Bridge (`DeskBridge`)**: Asynchronous Kotlin `HttpURLConnection` bridge so the bundled web app can fetch live financial and news data without CORS restrictions.

## Project Structure

- `app/src/main/java/com/muratangin/deskdisplay/MainActivity.kt` — Immersive WebView host & `DeskBridge`
- `app/src/main/assets/web/` — Bundled HTML/CSS/ES6 web application
  - `js/views/markets.js` — Finance cards & interactive canvas chart
  - `js/views/photos.js` — Fullscreen slideshow & HUD controls
  - `js/views/hackernews.js` — HN front page & article/comments reader

## Build & Install

```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.muratangin.deskdisplay/.MainActivity
```
