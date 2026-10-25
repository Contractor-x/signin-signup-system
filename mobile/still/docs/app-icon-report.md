# STILL — App Icon Report

## 1. Summary
The STILL app icon is a rendered 3D shopping bag in burnt-orange (#F5A65A-ish) with the wordmark **"Still"** in black serif typography centered on the bag face, set against the app's cream background (#F2EFE7).

## 2. Source Asset
- Master artwork: `assets/brand/still-logo-source.png` (512 × 512, PNG, white background)
- The white background is removed via border-connected flood fill so enclosed white highlights on the bag (handle reflections, white text pocket) are preserved.

## 3. Generated Derivatives
All generated at **1024 × 1024**:

| File | Purpose | Format | Background |
|------|---------|--------|------------|
| `assets/icon.png` | iOS / legacy app icon | PNG | Cream (#F2EFE7) square, full-bleed bag |
| `assets/android-icon-foreground.png` | Android adaptive icon foreground | PNG (transparent) | Transparent; bag centered at 58% height |
| `assets/android-icon-background.png` | Android adaptive icon background | PNG (opaque) | Solid cream (#F2EFE7) |
| `assets/android-icon-monochrome.png` | Android themed/monochrome icon | PNG (transparent) | White bag silhouette mask |

## 4. Adaptive Icon Notes (Android)
- `backgroundColor`: `#F2EFE7` (cream, matches app background)
- `foregroundImage`: the bag-with-wordmark cutout
- `monochromeImage`: solid white silhouette of the bag for Android themed icons
- Safe zone: bag occupies ~58% of height so it fits within the 66% inner adaptive safe zone; nothing important sits in the outer thirds.

## 5. Usage in `app.json`
```json
"icon": "./assets/icon.png",
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#F2EFE7",
    "foregroundImage": "./assets/android-icon-foreground.png",
    "monochromeImage": "./assets/android-icon-monochrome.png"
  }
}
```

## 6. Generation Script
`scripts/generate_brand_assets.py` — reads `assets/brand/still-logo-source.png`, performs background removal, composites onto cream/scaled canvas, and writes all derivatives.

## 7. Display
Shown on home screen, app drawer, and as the legacy launcher icon on pre-adaptive devices.
