"""Draw KindRise's app icon and splash from the brand monogram and wordmark.

Run:  python scripts/make-icons.py   (needs Pillow; uses Fraunces from node_modules)
Writes the PNGs in assets/ that app.json points to.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'node_modules' / '@expo-google-fonts' / 'fraunces'
BOLD = str(FONTS / '700Bold' / 'Fraunces_700Bold.ttf')
SEMI = str(FONTS / '600SemiBold' / 'Fraunces_600SemiBold.ttf')

NIGHT = (14, 18, 48, 255)
AMBER = (255, 180, 84, 255)
LINEN = (247, 241, 232, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling for smooth edges


def sun(d, cx, cy, r, color, s, ray_from, ray_to, ray_w):
    d.pieslice([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], 180, 360, fill=color)
    for a in (15, 45, 75, 105, 135, 165):
        t = math.radians(a)
        x1, y1 = cx + ray_from * math.cos(t), cy - ray_from * math.sin(t)
        x2, y2 = cx + ray_to * math.cos(t), cy - ray_to * math.sin(t)
        line(d, x1, y1, x2, y2, color, ray_w, s)


def line(d, x1, y1, x2, y2, color, w, s):
    d.line([x1 * s, y1 * s, x2 * s, y2 * s], fill=color, width=round(w * s))
    for x, y in ((x1, y1), (x2, y2)):  # round caps
        d.ellipse([(x - w / 2) * s, (y - w / 2) * s, (x + w / 2) * s, (y + w / 2) * s], fill=color)


def monogram(size, scale, k_color, r_color, accent, bg=None):
    """K over R with the horizon and the rising sun, centred. Units match the 200-unit design."""
    s = size * SS / 200
    img = Image.new('RGBA', (size * SS, size * SS), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # The design's bounding box centre is about (105, 102); move it to (100, 100) and scale.
    def T(x, y):
        return 100 + (x - 105) * scale, 100 + (y - 102) * scale
    font = ImageFont.truetype(BOLD, round(66 * scale * s))
    kx, ky = T(72, 88)
    d.text((kx * s, ky * s), 'K', font=font, fill=k_color, anchor='ms')
    rx, ry = T(72, 164)
    d.text((rx * s, ry * s), 'R', font=font, fill=r_color, anchor='ms')
    a1, b1 = T(44, 100); a2, _ = T(124, 100)
    line(d, a1, b1, a2, b1, accent, 4 * scale, s)
    c1, _ = T(156, 100); c2, _ = T(166, 100)
    line(d, c1, b1, c2, b1, accent, 4 * scale, s)
    cx, cy = T(140, 100)
    sun(d, cx, cy, 15 * scale, accent, s, 21 * scale, 30 * scale, 3 * scale)
    return img.resize((size, size), Image.LANCZOS)


def wordmark(size, scale):
    """Kind over Rise with the sun, for the splash screen (transparent background)."""
    s = size * SS / 220
    img = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    def T(x, y):
        return 110 + (x - 118) * scale, 110 + (y - 112) * scale
    font = ImageFont.truetype(SEMI, round(58 * scale * s))
    x, y = T(26, 88)
    d.text((x * s, y * s), 'Kind', font=font, fill=LINEN, anchor='ls')
    x, y = T(26, 160)
    d.text((x * s, y * s), 'Rise', font=font, fill=AMBER, anchor='ls')
    a1, b1 = T(24, 102); a2, _ = T(168, 102)
    line(d, a1, b1, a2, b1, AMBER, 3 * scale, s)
    c1, _ = T(200, 102); c2, _ = T(212, 102)
    line(d, c1, b1, c2, b1, AMBER, 3 * scale, s)
    cx, cy = T(184, 102)
    sun(d, cx, cy, 16 * scale, AMBER, s, 22 * scale, 32 * scale, 3 * scale)
    return img.resize((size, size), Image.LANCZOS)


def main():
    a = ROOT / 'assets'
    # Adaptive icon: content must sit in the central safe zone (about 61% of the canvas).
    monogram(1024, 0.82, LINEN, AMBER, AMBER).save(a / 'android-icon-foreground.png')
    Image.new('RGBA', (1024, 1024), NIGHT).save(a / 'android-icon-background.png')
    monogram(1024, 0.82, WHITE, WHITE, WHITE).save(a / 'android-icon-monochrome.png')
    # Full icon (store, iOS later, web): navy square, monogram a little larger.
    monogram(1024, 1.15, LINEN, AMBER, AMBER, bg=NIGHT).save(a / 'icon.png')
    monogram(48, 1.25, LINEN, AMBER, AMBER, bg=NIGHT).save(a / 'favicon.png')
    wordmark(1024, 0.85).save(a / 'splash-icon.png')
    print('icons written')


if __name__ == '__main__':
    main()
