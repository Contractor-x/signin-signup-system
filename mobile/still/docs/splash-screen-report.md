# STILL — Splash Screen Report

## 1. Summary
The native splash is the only startup splash. It shows the STILL shopping bag with "By Umusa" beneath it on cream (#F2EFE7), stays up until the first screen has painted, then reveals the shop. There is no second JS splash overlay.

## 2. Source Asset
- Splash icon: `assets/splash-icon.png` (1024 × 1024 PNG, transparent)
- The bag-with-wordmark cutout is trimmed to 346 × 563 and centered on the 1024 canvas.
- "By Umusa" is baked into the PNG below the bag: DejaVu Sans Mono, 44 px at 1024, `#5F6258`, 2 px kerning. At `imageWidth: 288` this renders at roughly 12.4 dp, matching the app's caption scale.
- The splash asset is separate from the app icon.

## 3. Configuration (`app.json`)
```json
"plugins": [
  "expo-router",
  [
    "expo-splash-screen",
    {
      "backgroundColor": "#F2EFE7",
      "image": "./assets/splash-icon.png",
      "imageWidth": 288,
      "resizeMode": "contain"
    }
  ]
]
```

| Property | Value | Reason |
|----------|-------|--------|
| `backgroundColor` | `#F2EFE7` | Cream, matches app background — seamless transition |
| `image` | `./assets/splash-icon.png` | Bag logo with wordmark and "By Umusa" credit |
| `imageWidth` | `288` | ~28% of screen width on mdpi scale — prominent but not overwhelming |
| `resizeMode` | `contain` | Keeps the full logo and credit visible without cropping |

## 4. Runtime Behavior
- `src/app/_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at module scope, so the native splash remains until the first screen paints.
- A zero-delay mount effect calls `SplashScreen.hideAsync()` after the shop is mounted underneath; no artificial hold and no JS splash overlay.
- `SplashScreen.setOptions({ duration: 300, fade: true })`; the fade option is iOS-only per the Expo docs. Android uses the system splash exit.
- Session restore is deferred until after the first paint and does not block the demo shop.
- Cold-start sequence: tap icon → native splash (bag + "By Umusa") → shop.

## 5. Generated Native Resources
The splash drawables were regenerated from the updated `assets/splash-icon.png`:
- `android/app/src/main/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/splashscreen_logo.png` at 288–1152 px
- `android/app/src/main/res/values/colors.xml` — `splashscreen_background = #F2EFE7`, `iconBackground = #F2EFE7`
- `android/app/src/main/res/values/styles.xml` — `Theme.App.SplashScreen` parented to `Theme.SplashScreen` with `windowSplashScreenBackground`, `windowSplashScreenAnimatedIcon`, `windowSplashScreenBehavior = icon_preferred`
- `AndroidManifest.xml` — `MainActivity` theme set to `Theme.App.SplashScreen`

A future `npx expo prebuild --platform android` regenerates these drawables from the updated asset.

## 6. Android Native Behavior (API 12+)
- The system shows the themed splash during cold start using the branded image.
- The splash is held by `preventAutoHideAsync` until the JS root is ready; `hideAsync` then reveals the shop.
- No second branded screen is drawn in JS.
- The credit is part of the image and is kept inside the central composition so it remains visible on Android 12+ splash treatments.

## 7. Testing
- A release/preview build is required for the true startup sequence; the Expo dev client shows its own loading screen between the native splash and the JS app.
- The duplicate JS splash has been removed; the single native splash is pending verification on `emulator-5554` via an EAS preview APK.
- Startup measurement will be recorded from the EAS preview cold launch.
