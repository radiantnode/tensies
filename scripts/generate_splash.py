"""Generate iOS apple-touch-startup-image PNGs for every current device size.

Run inside Docker:
    docker compose run --rm web python scripts/generate_splash.py

Resizes static/images/splash/source.png to each device resolution.
Outputs PNGs to static/images/splash/ and prints the <link> tags for index.html.
"""

import subprocess
import sys
from pathlib import Path

_TMP_PKGS = "/tmp/splash_pkgs"
sys.path.insert(0, _TMP_PKGS)
try:
    from PIL import Image
except ImportError:
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", f"--target={_TMP_PKGS}", "Pillow"],
        stdout=subprocess.DEVNULL,
    )
    from PIL import Image

SOURCE = Path("static/images/splash/source.png")

# (css_width, css_height, dpr, label) — portrait only, Tensies is portrait-locked.
DEVICES = [
    (440, 956, 3, "iPhone 16 Pro Max"),
    (402, 874, 3, "iPhone 16 Pro"),
    (430, 932, 3, "iPhone 15 Pro Max / 16 Plus"),
    (393, 852, 3, "iPhone 15 / 15 Pro / 16"),
    (428, 926, 3, "iPhone 14 Plus / 13 Pro Max"),
    (390, 844, 3, "iPhone 14 / 13 / 13 Pro / 12"),
    (375, 812, 3, "iPhone 13 mini / 12 mini / X / XS / 11 Pro"),
    (414, 896, 3, "iPhone 11 Pro Max / XS Max"),
    (414, 896, 2, "iPhone 11 / XR"),
    (375, 667, 2, "iPhone SE 3rd / 8 / 7 / 6s"),
]

OUT_DIR = Path("static/images/splash")
OUT_DIR.mkdir(parents=True, exist_ok=True)

src = Image.open(SOURCE)
link_tags = []

for css_w, css_h, dpr, label in DEVICES:
    px_w = css_w * dpr
    px_h = css_h * dpr
    fname = f"splash-{px_w}x{px_h}.png"
    fpath = OUT_DIR / fname

    # Scale to cover (preserve aspect ratio), then center-crop to exact size.
    src_ratio = src.width / src.height
    dst_ratio = px_w / px_h
    if src_ratio > dst_ratio:
        # Source is wider — fit height, crop width
        scale_h = px_h
        scale_w = int(src.width * (px_h / src.height))
    else:
        # Source is taller — fit width, crop height
        scale_w = px_w
        scale_h = int(src.height * (px_w / src.width))
    scaled = src.resize((scale_w, scale_h), Image.LANCZOS)

    # Center on black canvas at exact target size
    canvas = Image.new("RGB", (px_w, px_h), (0, 0, 0))
    offset_x = (px_w - scale_w) // 2
    offset_y = (px_h - scale_h) // 2
    canvas.paste(scaled, (offset_x, offset_y))
    canvas.save(fpath, "PNG", optimize=True)

    tag = (
        f'  <link rel="apple-touch-startup-image" '
        f'href="/static/images/splash/{fname}" '
        f'media="(device-width: {css_w}px) and (device-height: {css_h}px) '
        f'and (-webkit-device-pixel-ratio: {dpr}) and (orientation: portrait)">'
    )
    link_tags.append(tag)
    print(f"  {fname}  ({label})")

print()
print("<!-- iOS splash screens (apple-touch-startup-image) -->")
for tag in link_tags:
    print(tag)
print()
print(f"Done — {len(DEVICES)} images in {OUT_DIR}/")
