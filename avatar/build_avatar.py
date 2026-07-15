#!/usr/bin/env python3
"""Rigged vector toon avatar approximating the reference photo.

Parametric so it can be animated (blink, brows, look-dir, mouth/lip-sync).
Renders a model sheet of expressions for approval.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
SS = 3  # supersample

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# palette (from the reference)
SKIN = (240, 197, 158)
SKIN_SH = (223, 170, 128)
EAR = (233, 183, 143)
HAIR = (92, 62, 38)
HAIR_HI = (120, 84, 50)
BROW = (74, 50, 30)
IRIS = (104, 128, 92)
PUP = (38, 30, 24)
CHEEK = (255, 150, 138, 150)
MOUTH_IN = (120, 58, 58)
TEETH = (250, 248, 244)
BRACE = (150, 156, 166)
WIRE = (120, 126, 136)
SHIRT = (39, 79, 160)
SHIRT_SH = (30, 62, 128)
STAR = (245, 246, 250)
OUT_INK = (70, 52, 40)      # softer than pure black -> features read as part of the face
FEAT_INK = (92, 66, 50)     # even softer, for internal feature lines


def hx(c):
    return c


def draw_toon(img, d, cx, cy, s=1.0, expr=None):
    """img = target RGBA image, d = its ImageDraw. cx,cy = head center."""
    e = {
        "brow_y": 0, "brow_ang": 0,      # eyebrow raise / angle
        "eye_open": 1.0,                  # 1 open, 0 blink
        "look_x": 0, "look_y": 0,         # pupil offset
        "mouth": "smile",                 # mouth shape
        "head_tilt": 0,                   # degrees
    }
    if expr:
        e.update(expr)

    def P(dx, dy):
        # simple head tilt about center
        a = math.radians(e["head_tilt"])
        x = dx * math.cos(a) - dy * math.sin(a)
        y = dx * math.sin(a) + dy * math.cos(a)
        return (cx + x * s, cy + y * s)

    def ell(p, rx, ry, **kw):
        d.ellipse([(p[0] - rx * s) * SS, (p[1] - ry * s) * SS,
                   (p[0] + rx * s) * SS, (p[1] + ry * s) * SS], **{k: v for k, v in kw.items()})

    W = lambda w: max(1, int(w * s * SS))

    # ---- neck + shirt (drawn first, behind head) ----
    nk = P(0, 150)
    d.rectangle([(nk[0] - 45 * s) * SS, (nk[1] - 60 * s) * SS, (nk[0] + 45 * s) * SS, (nk[1] + 20 * s) * SS],
                fill=SKIN_SH)
    # shirt body
    sh = P(0, 300)
    d.rounded_rectangle([(sh[0] - 250 * s) * SS, (sh[1] - 130 * s) * SS, (sh[0] + 250 * s) * SS, (sh[1] + 120 * s) * SS],
                        radius=60 * SS, fill=SHIRT, outline=OUT_INK, width=W(5))
    # collar
    d.polygon([((sh[0] - 60 * s) * SS, (sh[1] - 150 * s) * SS), ((sh[0]) * SS, (sh[1] - 100 * s) * SS),
               ((sh[0] + 60 * s) * SS, (sh[1] - 150 * s) * SS)], fill=SHIRT_SH)
    # stars on shirt
    for (sx, sy, sr) in [(-150, -40, 26), (150, -40, 26), (0, 60, 30)]:
        star(d, sh[0] + sx * s, sh[1] + sy * s, sr * s, STAR)
    d.text(((sh[0]) * SS, (sh[1] + 30 * s) * SS), "VOTE", font=ImageFont.truetype(FONT, int(38 * s * SS)),
           fill=STAR, anchor="mm")

    # ---- ears ----
    for side in (-1, 1):
        ep = P(side * 118, 8)
        ell(ep, 26, 34, fill=EAR, outline=OUT_INK, width=W(4))

    # ---- head (round youthful) ----
    hd = P(0, 0)
    d.ellipse([(hd[0] - 130 * s) * SS, (hd[1] - 140 * s) * SS, (hd[0] + 130 * s) * SS, (hd[1] + 150 * s) * SS],
              fill=SKIN, outline=OUT_INK, width=W(5))

    # ---- soft form-shading layer (subtle, blurred, clipped to the head) ----
    shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)

    def soft_ell(p, rx, ry, a):
        sd.ellipse([(p[0] - rx * s) * SS, (p[1] - ry * s) * SS, (p[0] + rx * s) * SS, (p[1] + ry * s) * SS],
                   fill=SKIN_SH + (a,))

    def blush_ell(p, rx, ry, a):
        sd.ellipse([(p[0] - rx * s) * SS, (p[1] - ry * s) * SS, (p[0] + rx * s) * SS, (p[1] + ry * s) * SS],
                   fill=(255, 150, 138, a))
    soft_ell(P(0, -62), 104, 14, 42)                     # forehead contact
    soft_ell(P(-58, -8), 34, 18, 40); soft_ell(P(58, -8), 34, 18, 40)  # eye sockets (subtle)
    soft_ell(P(7, 18), 9, 26, 46)                        # nose bridge side
    soft_ell(P(0, 46), 16, 10, 48)                       # under nose tip
    soft_ell(P(0, 118), 44, 15, 40)                      # under-lip / chin
    blush_ell(P(-80, 60), 34, 21, 95); blush_ell(P(80, 60), 34, 21, 95)  # cheeks
    shade = shade.filter(ImageFilter.GaussianBlur(4 * SS))
    # clip to head so nothing glows past the silhouette
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse([(hd[0] - 128 * s) * SS, (hd[1] - 138 * s) * SS,
                                  (hd[0] + 128 * s) * SS, (hd[1] + 148 * s) * SS], fill=255)
    shade.putalpha(ImageChops.multiply(shade.getchannel("A"), mask))
    img.alpha_composite(shade)

    # ---- hair (spiky short brown) ----
    draw_hair(d, P, s, W)

    # ---- eyebrows (thick) — sit closer to the eyes ----
    for side in (-1, 1):
        bx = side * 60
        by = -40 + e["brow_y"] - e["brow_ang"] * side * 0.6
        bp = P(bx, by)
        ang = -side * (6 + e["brow_ang"])
        brow_shape(d, bp, 44 * s, 14 * s, ang, s, W)

    # ---- eyes (softer outline, nestled) ----
    for side in (-1, 1):
        ex = side * 60
        ep = P(ex, -6)
        if e["eye_open"] < 0.18:
            d.arc([(ep[0] - 30 * s) * SS, (ep[1] - 12 * s) * SS, (ep[0] + 30 * s) * SS, (ep[1] + 12 * s) * SS],
                  20, 160, fill=FEAT_INK, width=W(5))
            continue
        oy = 21 * e["eye_open"]
        d.ellipse([(ep[0] - 30 * s) * SS, (ep[1] - oy * s) * SS, (ep[0] + 30 * s) * SS, (ep[1] + oy * s) * SS],
                  fill=(255, 255, 255), outline=FEAT_INK, width=W(3))
        ix = ep[0] + e["look_x"] * 9 * s
        iy = ep[1] + e["look_y"] * 7 * s
        ir = 17 * s
        d.ellipse([(ix - ir) * SS, (iy - ir) * SS, (ix + ir) * SS, (iy + ir) * SS], fill=IRIS)
        d.ellipse([(ix - 8 * s) * SS, (iy - 8 * s) * SS, (ix + 8 * s) * SS, (iy + 8 * s) * SS], fill=PUP)
        d.ellipse([(ix + 2 * s) * SS, (iy - 6 * s) * SS, (ix + 8 * s) * SS, (iy) * SS], fill=(255, 255, 255))
        # upper lid: heavier line on top only, for a soft-set eye
        d.arc([(ep[0] - 30 * s) * SS, (ep[1] - oy * s - 3 * s) * SS, (ep[0] + 30 * s) * SS, (ep[1] + oy * s) * SS],
              185, 355, fill=FEAT_INK, width=W(4))

    # ---- nose (subtle line only; form comes from the shade layer) ----
    npt = P(0, 34)
    d.arc([(npt[0] - 18 * s) * SS, (npt[1] - 8 * s) * SS, (npt[0] + 4 * s) * SS, (npt[1] + 14 * s) * SS],
          30, 160, fill=FEAT_INK, width=W(4))
    for side in (-1, 1):
        no = P(side * 11, 40)
        d.ellipse([(no[0] - 3 * s) * SS, (no[1] - 2 * s) * SS, (no[0] + 3 * s) * SS, (no[1] + 2 * s) * SS], fill=(150, 110, 84))

    # ---- mouth (+ braces) ----
    draw_mouth(d, P, s, W, e["mouth"])


def star(d, cx, cy, r, fill):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append(((cx + rad * math.cos(ang)) * SS, (cy + rad * math.sin(ang)) * SS))
    d.polygon(pts, fill=fill)


def brow_shape(d, p, w, h, ang, s, W):
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    x0, y0 = p[0] - w / 2 * dx, p[1] - w / 2 * dy
    x1, y1 = p[0] + w / 2 * dx, p[1] + w / 2 * dy
    d.line([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=BROW, width=W(15))
    for (xx, yy) in [(x0, y0), (x1, y1)]:
        d.ellipse([(xx - 7 * s) * SS, (yy - 7 * s) * SS, (xx + 7 * s) * SS, (yy + 7 * s) * SS], fill=BROW)


def draw_hair(d, P, s, W):
    # side hair framing the face (down to short sideburns), skin forehead stays clear
    for side in (-1, 1):
        sp = P(side * 118, -30)
        d.ellipse([(sp[0] - 34 * s) * SS, (sp[1] - 100 * s) * SS, (sp[0] + 34 * s) * SS, (sp[1] + 55 * s) * SS], fill=HAIR)
    # top cap: bottom edge is the hairline (forehead shows below), top edge is spiky
    hairline = [(-128, -58), (-92, -84), (-52, -90), (-8, -84), (0, -78),
                (44, -88), (88, -84), (128, -58)]          # L->R along the brow-line of the scalp
    spikes = [(122, -138), (92, -164), (58, -150), (30, -176), (2, -158),
              (-30, -178), (-58, -152), (-92, -166), (-122, -138)]  # R->L crown, jagged
    poly = [P(x, y) for (x, y) in hairline] + [P(x, y) for (x, y) in spikes]
    d.polygon([(p[0] * SS, p[1] * SS) for p in poly], fill=HAIR, outline=OUT_INK, width=W(4))
    # a couple of front fringe strands dipping onto the forehead (style, not covering eyes)
    for (fx, fy, ln) in [(-70, -78, 30), (-30, -80, 26), (30, -82, 26), (78, -76, 28)]:
        fp = P(fx, fy)
        d.line([fp[0] * SS, fp[1] * SS, (fp[0] + 10 * s) * SS, (fp[1] + ln * s) * SS], fill=HAIR, width=W(9))
    # highlight strands on the crown
    for hx0 in (-60, -10, 40, 84):
        hp = P(hx0, -128)
        d.line([hp[0] * SS, hp[1] * SS, (hp[0] + 10 * s) * SS, (hp[1] + 38 * s) * SS], fill=HAIR_HI, width=W(4))


def draw_mouth(d, P, s, W, shape):
    m = P(0, 92)
    def braces(x0, x1, y):
        d.line([(x0) * SS, y * SS, (x1) * SS, y * SS], fill=WIRE, width=W(3))
        n = 5
        for k in range(n):
            bx = x0 + (x1 - x0) * (k + 0.5) / n
            d.rectangle([(bx - 5 * s) * SS, (y - 5 * s) * SS, (bx + 5 * s) * SS, (y + 5 * s) * SS], fill=BRACE)
    if shape in ("smile", "grin", "laugh", "talk2", "o"):
        if shape == "smile":
            rx, ry = 48, 26
        elif shape == "grin":
            rx, ry = 60, 40
        elif shape == "laugh":
            rx, ry = 58, 52
        elif shape == "o":
            rx, ry = 30, 34
        else:  # talk2
            rx, ry = 44, 30
        d.ellipse([(m[0] - rx * s) * SS, (m[1] - ry * s) * SS, (m[0] + rx * s) * SS, (m[1] + ry * s) * SS],
                  fill=MOUTH_IN, outline=FEAT_INK, width=W(4))
        # upper teeth band
        d.rectangle([(m[0] - rx * s + 4 * s) * SS, (m[1] - ry * s + 3 * s) * SS,
                     (m[0] + rx * s - 4 * s) * SS, (m[1] - ry * s + 22 * s) * SS], fill=TEETH)
        braces(m[0] - rx * s + 8 * s, m[0] + rx * s - 8 * s, m[1] - ry * s + 12 * s)
        if shape in ("laugh",):  # lower teeth too
            d.rectangle([(m[0] - rx * s + 8 * s) * SS, (m[1] + ry * s - 20 * s) * SS,
                         (m[0] + rx * s - 8 * s) * SS, (m[1] + ry * s - 4 * s) * SS], fill=TEETH)
        # tongue
        d.ellipse([(m[0] - 22 * s) * SS, (m[1] + 2 * s) * SS, (m[0] + 22 * s) * SS, (m[1] + ry * s) * SS],
                  fill=(200, 96, 96))
    elif shape == "talk1":
        d.ellipse([(m[0] - 28 * s) * SS, (m[1] - 10 * s) * SS, (m[0] + 28 * s) * SS, (m[1] + 14 * s) * SS],
                  fill=MOUTH_IN, outline=FEAT_INK, width=W(4))
        d.rectangle([(m[0] - 24 * s) * SS, (m[1] - 8 * s) * SS, (m[0] + 24 * s) * SS, (m[1] + 2 * s) * SS], fill=TEETH)
    else:  # neutral closed smile
        d.arc([(m[0] - 46 * s) * SS, (m[1] - 30 * s) * SS, (m[0] + 46 * s) * SS, (m[1] + 26 * s) * SS],
              20, 160, fill=FEAT_INK, width=W(5))


EXPRS = {
    "idle": {"mouth": "smile"},
    "big grin": {"mouth": "grin", "brow_y": -6},
    "talking": {"mouth": "talk1"},
    "surprised": {"mouth": "o", "brow_y": -16, "eye_open": 1.25},
    "laughing": {"mouth": "laugh", "eye_open": 0.15, "brow_y": -4},
    "eyebrow raise": {"mouth": "neutral", "brow_y": -14, "brow_ang": 8, "look_x": 0.6},
    "blink": {"mouth": "smile", "eye_open": 0.1},
    "unimpressed": {"mouth": "neutral", "brow_y": 6, "eye_open": 0.7, "look_x": -0.6},
}


def avatar_tile(w, h, cx, cy, s, params):
    tile = Image.new("RGBA", (int(w * SS), int(h * SS)), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile, "RGBA")
    draw_toon(tile, td, cx, cy, s, params)
    return tile


def render_sheet():
    cols, rows = 4, 2
    cw, ch = 460, 560
    img = Image.new("RGB", (cols * cw * SS, (rows * ch + 90) * SS), (245, 244, 250))
    d = ImageDraw.Draw(img, "RGBA")
    d.text((cols * cw * SS / 2, 46 * SS), "AVATAR — model sheet", font=ImageFont.truetype(FONT, int(40 * SS)),
           fill=(40, 34, 28), anchor="mm")
    for i, (name, params) in enumerate(EXPRS.items()):
        r, c = divmod(i, cols)
        ox, oy = c * cw, r * ch + 90
        d.rounded_rectangle([(ox + 14) * SS, (oy + 14) * SS, (ox + cw - 14) * SS, (oy + ch - 14) * SS],
                            radius=20 * SS, outline=(210, 205, 220), width=2 * SS)
        tile = avatar_tile(cw, ch, cw / 2, ch / 2 - 30, 0.82, params)
        img.paste(tile, (ox * SS, oy * SS), tile)
        # label on a readable pill
        lp = (ox + cw / 2, oy + ch - 30)
        tw = len(name) * 17
        d.rounded_rectangle([(lp[0] - tw) * SS, (lp[1] - 24) * SS, (lp[0] + tw) * SS, (lp[1] + 24) * SS],
                            radius=16 * SS, fill=(255, 255, 255, 235), outline=(210, 205, 220), width=2 * SS)
        d.text((lp[0] * SS, lp[1] * SS), name, font=ImageFont.truetype(FONT, int(30 * SS)),
               fill=(60, 54, 66), anchor="mm")
    img.resize((cols * cw, rows * ch + 90), Image.LANCZOS).save(os.path.join(OUT, "avatar_model_sheet.png"))
    # big hero shot
    hero = Image.new("RGB", (720 * SS, 820 * SS), (245, 244, 250))
    tile = avatar_tile(720, 820, 360, 360, 1.35, {"mouth": "grin"})
    hero.paste(tile, (0, 0), tile)
    hero.resize((720, 820), Image.LANCZOS).save(os.path.join(OUT, "avatar_hero.png"))
    print("model sheet + hero done")


if __name__ == "__main__":
    render_sheet()
