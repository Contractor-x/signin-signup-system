# STILL — Splash Screen Report

## 1. Summary
The splash screen shows the STILL shopping-bag logo centered on a cream background (#F2EFE7), matching the app shell. It appears on cold/warm app launch until the Expo Router root layout is ready, then fades out over 500 ms.

## 2. Source Asset
- Splash icon: `assets/splash-icon.png` (1024 × 1024 PNG, transparent)
- The bag-with-wordmark cutout scaled to 55% height and centered on a transparent canvas.

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
| `image` | `./assets/splash-icon.png` | Bag logo with wordmark |
| `imageWidth` | `288` | ~28% of screen width on mdpi scale — prominent but not overwhelming |
| `resizeMode` | `contain` | Keeps full logo visible without cropping |

## 4. Runtime Behavior
- `src/app/_layout.tsx` calls `SplashScreen.setOptions({ duration: 500, fade: true })` — a 500 ms fade-out after the native splash dismisses.
- `expo-splash-screen` plugin requires a native rebuild (`npx expo prebuild` / Gradle) to take effect; it cannot be previewed reliably in Expo Go or a dev build per Expo docs.

## 5. Generated Native Resources
Created by `npx expo prebuild --platform android --no-install`:
- `android/app/src/main/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/splashscreen_logo.png` — vector-ready PNG at 288–1152 px
- `android/app/src/main/res/values/colors.xml` — `splashscreen_background = #F2EFE7`, `iconBackground = #F2EFE7`
- `android/app/src/main/res/values/styles.xml` — `Theme.App.SplashScreen` parented to `Theme.SplashScreen` with `windowSplashScreenBackground`, `windowSplashScreenAnimatedIcon`, `windowSplashScreenBehavior = icon_preferred`
- `AndroidManifest.xml` — `MainActivity` theme set to `Theme.App.SplashScreen`

## 6. Android Native Behavior (API 12+)
- System shows the splash screen during cold start using theme + animated icon.
- Exit animation is controlled by the system; the app draws its first frame and the splash dismisses automatically.
- No branding image is used (design guidelines discourage it).

## 7. Testing
- Splash screen is only fully reliable on a **release/preview production build** built via EAS or local Gradle, not Expo Go/dev client.
