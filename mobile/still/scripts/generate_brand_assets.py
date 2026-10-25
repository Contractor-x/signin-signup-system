#!/usr/bin/env python3
"""Generate STILL launcher and splash assets from the master bag artwork.

Usage: python3 scripts/generate_brand_assets.py

The master artwork is expected at assets/brand/still-logo-source.png.
It has a white background, which is removed with a border-connected flood
fill so enclosed white highlights on the bag are preserved.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
BRAND = ASSETS / "brand"
SOURCE = BRAND / "still-logo-source.png"

CREAM = (242, 239, 231, 255)  # #F2EFE7, matches the app background
NEAR_WHITE = 235
SIZE = 1024


def cut_out_background(source: Image.Image) -> Image.Image:
    rgb = np.array(source.convert("RGB")).astype(np.uint8)
    near_white = (
        (rgb[:, :, 0] >= NEAR_WHITE)
        & (rgb[:, :, 1] >= NEAR_WHITE)
        & (rgb[:, :, 2] >= NEAR_WHITE)
    )

    labels, _ = ndimage.label(near_white)
    border_labels = set(labels[0, :]) | set(labels[-1, :])
    border_labels |= set(labels[:, 0]) | set(labels[:, -1])
    background = np.isin(labels, list(border_labels))

    keep = ~background
    # Erode a single pixel to remove the white anti-aliased fringe.
    keep = ndimage.binary_erosion(keep, iterations=1)

    alpha = np.where(keep, 255, 0).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    return Image.fromarray(rgba, "RGBA")


def fit_on_canvas(
    image: Image.Image,
    *,
    height_ratio: float,
    background=CREAM,
) -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), background)

    bbox = image.getbbox()
    art = image.crop(bbox)
    target_h = int(SIZE * height_ratio)
    target_w = round(art.width * target_h / art.height)
    art = art.resize((target_w, target_h), Image.LANCZOS)

    x = (SIZE - target_w) // 2
    y = (SIZE - target_h) // 2
    canvas.alpha_composite(art, (x, y))
    return canvas


def make_monochrome(image: Image.Image) -> Image.Image:
    """Bag silhouette with the wordmark cut out for Android themed icons."""
    arr = np.array(image)
    alpha = arr[:, :, 3].copy()
    dark = arr[:, :, :3].max(axis=2) < 40
    alpha[dark] = 0

    out = np.zeros_like(arr)
    out[:, :, 3] = alpha
    # Android tints the drawable, so any opaque colour works.
    out[alpha > 0, :3] = 255
    return Image.fromarray(out, "RGBA")


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        raise SystemExit(f"Missing master artwork: {SOURCE}")

    cutout = cut_out_background(Image.open(SOURCE))

    # Legacy / iOS icon: full-bleed cream square, no transparency.
    icon = fit_on_canvas(cutout, height_ratio=0.62)
    icon.convert("RGB").save(ASSETS / "icon.png", optimize=True)

    # Adaptive icon foreground: the central 66% is the safe zone.
    foreground = fit_on_canvas(cutout, height_ratio=0.58, background=(0, 0, 0, 0))
    foreground.save(ASSETS / "android-icon-foreground.png", optimize=True)

    background = Image.new("RGBA", (SIZE, SIZE), CREAM)
    background.save(ASSETS / "android-icon-background.png", optimize=True)

    make_monochrome(foreground).save(ASSETS / "android-icon-monochrome.png", optimize=True)

    # Splash icon: transparent so the cream window background shows through.
    splash = fit_on_canvas(cutout, height_ratio=0.55, background=(0, 0, 0, 0))
    splash.save(ASSETS / "splash-icon.png", optimize=True)

    # Reusable transparent logo for in-app use.
    fit_on_canvas(cutout, height_ratio=0.9, background=(0, 0, 0, 0)).save(
        BRAND / "still-bag.png", optimize=True
    )

    print("Wrote icon, adaptive icon, monochrome, splash and brand logo assets.")


if __name__ == "__main__":
    main()
