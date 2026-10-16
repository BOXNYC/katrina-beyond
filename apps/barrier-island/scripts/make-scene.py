"""
Builds the Barrier Island scene variants from the painted base plate.

  python3 scripts/make-scene.py     (needs: pip install pillow numpy)

assets/scene/source.png is the artwork with every defense in place. Each
feature gets an "off" strip made by removing that feature's pixels and filling
in the sky, water or ground that would be behind it. The Levee also gets a
"medium" strip. Strips cover only their own columns, so any mix of states can
be shown by laying strips over base.jpg. Writes assets/scene/*.png and
src/lib/sceneStrips.ts.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/scene/source.png"
OUT = ROOT / "assets/scene"
Y0, Y1 = 470, 740  # rows the strips cover
HOR = 629  # first row of the sea at the horizon

a = np.array(Image.open(SRC).convert("RGB")).astype(np.float32)
H, W, _ = a.shape
R, G, B = a[..., 0], a[..., 1], a[..., 2]
rng = np.random.default_rng(7)

# ---- masks ------------------------------------------------------------------
mx, mn = a.max(axis=2), a.min(axis=2)
neutral_dark = ((mx - mn) < 28) & (mx < 150)
halo = ((G - B) > -20) & (R < 200) & (R > 100)  # antialiased fringe around vegetation
land = ((R - B) >= 8) | ((G - B) >= 6) | neutral_dark | halo  # vegetation, sand, stone


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


land_d = dilate(land, 3)
sand = ((R - B) >= 12) & (R >= 205) & (G >= 195)

# ---- ground surface (top of the sand body) -----------------------------------
s = np.zeros(W)
for x in range(W):
    y = 520
    while y < 780 and not sand[y : y + 12, x].all():
        y += 1
    s[x] = y


def smooth(v, k):
    pad = np.pad(v, k // 2, mode="edge")
    return np.array([np.median(pad[i : i + k]) for i in range(len(v))])


s_med = np.convolve(np.pad(smooth(s, 21), 4, mode="edge"), np.ones(9) / 9, mode="valid")

# ---- background plates (taken from the painting itself) -----------------------
sky_like = (B > R + 30) & (B > G + 10) & (R > 150)
water_like = (B > R + 60) & (R < 140)


def row_plate(mask, x0, x1, rows):
    """Per-row median color of `mask` pixels in columns x0..x1."""
    out = {}
    last = None
    for y in rows:
        m = mask[y, x0:x1]
        if m.sum() >= 6:
            last = np.median(a[y, x0:x1][m], axis=0)
        out[y] = last
    first = next(v for v in out.values() if v is not None)
    return {y: (v if v is not None else first) for y, v in out.items()}


ROWS = range(Y0 - 40, Y1 + 20)
sky_by_region = {}


def sky_plate(x0, x1):
    key = (x0, x1)
    if key not in sky_by_region:
        sky_by_region[key] = row_plate(sky_like, max(x0 - 300, 0), min(x1 + 300, W), ROWS)
    return sky_by_region[key]


water_left = row_plate(water_like, 10, 130, range(HOR, Y1 + 20))
water_right = row_plate(water_like, 440, 760, range(HOR, Y1 + 20))


def noise(shape, sigma=1.1):
    return rng.normal(0, sigma, shape)


def ripple(y, x):
    """Gentle horizontal variation so filled-in water doesn't look banded."""
    return 8.0 * np.sin(x / 47.0 + y * 1.7) + 5.0 * np.sin(x / 15.0 - y * 0.9) + 3.0 * np.sin(x / 7.0 + y * 2.3)


# ---- grass fringe for land edges ---------------------------------------------
def fringe(out, n, x0, x1, w, seed, thick=11):
    r = np.random.default_rng(seed)
    base = r.random(W)
    for x in range(x0, x1):
        h = int(round(thick * (0.55 + 0.7 * np.convolve(base, np.ones(3) / 3, "same")[x])))
        yn = int(round(n[x]))
        for dy in range(h):
            t = dy / max(h - 1, 1)
            col = np.array([92, 134, 50]) * (1 - t) + np.array([168, 204, 84]) * t
            col = col + r.normal(0, 6)
            alpha = w[x] * (0.55 if dy == h - 1 else 1.0)
            y = yn - 1 - dy
            out[y, x] = out[y, x] * (1 - alpha) + col * alpha
        for dy in (0, 1):  # dark rim where grass meets sand
            y = yn + dy
            out[y, x] = out[y, x] * (1 - w[x]) + np.array([86, 116, 52]) * w[x]


# ---- variant builder ------------------------------------------------------------
def weights(x0, x1, fl, fr):
    w = np.ones(W)
    for x in range(x0, x1):
        if fl and x < x0 + fl:
            w[x] = (x - x0) / fl
        if fr and x >= x1 - fr:
            w[x] = min(w[x], (x1 - 1 - x) / fr)
    return w


def build(x0, x1, n, plate, w, mask=land_d, land_edge=False, seed=1):
    out = a.copy()
    for x in range(x0, x1):
        ny = int(round(n[x]))
        ys = np.arange(Y0 - 40, ny)
        m = mask[ys, x]
        yy = ys[m]
        if len(yy):
            new = np.stack([plate(y, x) for y in yy]) + noise((len(yy), 3))
            out[yy, x] = out[yy, x] * (1 - w[x]) + new * w[x]
    if land_edge:
        fringe(out, n, x0, x1, w, seed)
    return out


def sky_or_water(x0, x1, water="right"):
    sky = sky_plate(x0, x1)

    def plate(y, x):
        if y < HOR:
            return sky[y]
        if water == "sky":
            return sky[HOR - 1]
        if water == "blend":
            t = np.clip((x - 200) / 280, 0, 1)
            return water_left[y] * (1 - t) + water_right[y] * t + ripple(y, x)
        return water_right[y] + ripple(y, x)

    return plate


def lerp_line(x0, x1, y0, y1):
    n = np.zeros(W)
    for x in range(W):
        n[x] = y0 + (y1 - y0) * np.clip((x - x0) / (x1 - x0), 0, 1)
    return n


variants = {}

# Barrier island: the dune is gone; sea washes over a low sandbar.
x0, x1 = 192, 528
n = np.maximum(lerp_line(x0, x1, s_med[x0], s_med[x1]), s_med)
variants["barrier-off"] = (x0, x1, build(x0, x1, n, sky_or_water(x0, x1, "blend"), weights(x0, x1, 40, 0)))

# Marsh landbridge: the grass is gone and open water covers the flats.
x0, x1 = 528, 752
n = s_med + 6
variants["marsh-off"] = (x0, x1, build(x0, x1, n, sky_or_water(x0, x1), weights(x0, x1, 0, 0)))

# Natural ridge: hump and trees removed, low flat ground left.
x0, x1 = 752, 1128
n = np.maximum(lerp_line(x0 + 16, x1 - 16, s_med[x0 + 16] - 8, s_med[x1 - 16] - 8), s_med - 0)
n = np.minimum(n, 676)
w = weights(x0, x1, 0, 40)
variants["ridge-off"] = (
    x0, x1,
    build(x0, x1, n, sky_or_water(x0, x1, "sky"), w, land_edge=True, seed=3),
)

# Levee: none, and a medium one squashed to about half its height. The region
# runs past the levee to take the tree it half-hides, so no fragment is left.
x0, x1 = 1296, 1460
base_y = lerp_line(x0, x1, s_med[1288], s_med[1470])
lw = weights(x0, x1, 24, 12)
none_img = build(x0, x1, base_y, sky_or_water(x0, x1, "sky"), lw, land_edge=True, seed=5)
variants["levee-none"] = (x0, x1, none_img)

med = none_img.copy()
k = 0.55
for x in range(x0, x1):
    by = int(round(base_y[x]))
    if not land[by - 4, x] or by - 4 < 0:
        pass
    for y in range(by - 70, by):
        ys = int(round(by - (by - y) / k))
        if 0 <= ys < H and land_d[ys, x] and ys < by - 1 and lw[x] > 0.99:
            med[y, x] = a[ys, x]
    # levee body continues straight into the sand: no grass rim across its base
    if lw[x] > 0.99 and land_d[by - 3, x] and x < 1440:
        med[by - 1 : by + 3, x] = a[by - 1 : by + 3, x]
variants["levee-medium"] = (x0, x1, med)

# ---- write ----------------------------------------------------------------------
Image.fromarray(a.astype(np.uint8)).save(OUT / "base.jpg", quality=92, subsampling=0)
manifest = {}
for name, (vx0, vx1, img) in variants.items():
    crop = np.clip(img[Y0:Y1, vx0:vx1], 0, 255).astype(np.uint8)
    Image.fromarray(crop).save(OUT / f"{name}.png", optimize=True)
    manifest[name] = {"x": vx0, "y": Y0, "w": vx1 - vx0, "h": Y1 - Y0}

ts = ["// Generated by scripts/make-scene.py. Do not edit.", "",
      "export const SCENE_W = %d;" % W, "export const SCENE_H = %d;" % H, "",
      "export const sceneStrips = {"]
for name, m in manifest.items():
    key = name.replace("-", "_")
    ts.append(f'  {key}: {{ src: require("../../assets/scene/{name}.png"), x: {m["x"]}, y: {m["y"]}, w: {m["w"]}, h: {m["h"]} }},')
ts.append("} as const;")
(ROOT / "src/lib/sceneStrips.ts").write_text("\n".join(ts) + "\n")
print(json.dumps(manifest))
