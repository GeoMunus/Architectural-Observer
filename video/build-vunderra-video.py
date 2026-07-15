#!/usr/bin/env python3
"""VUNDERRA — a character-driven fantasy geography explainer.

Host 'Pip' (parametric, 6 poses) tours a made-up continent's 5 countries,
each built on a real geographic idea pushed to a fun extreme. Bright storybook
look. Kokoro warm voice. Self-contained: TTS -> PIL frames -> ffmpeg.
"""
import math
import os
import random
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
TTSDIR = os.path.join(BASE, "..", "ttsvoice")
OUT = os.path.join(BASE, "vund_out")
os.makedirs(OUT, exist_ok=True)

SR = 24000
W, H = 1920, 1080
SS = 2
FPS_R = 15
FPS_O = 30

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# ---------------------------------------------------------------- TTS
_sess = _tok = _voices = None


def tts(text, voice="af_heart", speed=1.0):
    global _sess, _tok, _voices
    if _sess is None:
        import onnxruntime as ort
        from kokoro_onnx.tokenizer import Tokenizer
        _tok = Tokenizer()
        _sess = ort.InferenceSession(os.path.join(TTSDIR, "kokoro-model.onnx"))
        _voices = np.load(os.path.join(TTSDIR, "voices.npz"))
    import re
    text = text.replace("\n", " ").strip()
    pieces = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    for p in pieces:
        p = p.strip()
        if not p:
            continue
        toks = _tok.tokenize(_tok.phonemize(p, lang="en-us"))
        if len(toks) <= 500:
            chunks.append(toks)
        else:
            for sub in re.split(r",\s+", p):
                st = _tok.tokenize(_tok.phonemize(sub, lang="en-us"))
                for k in range(0, len(st), 500):
                    chunks.append(st[k:k + 500])
    out = []
    for c in chunks:
        if not c:
            continue
        ref = _voices[voice][len(c)]
        ids = np.array([[0] + c + [0]], dtype=np.int64)
        a = _sess.run(None, {"input_ids": ids, "style": ref.astype(np.float32),
                             "speed": np.array([speed], dtype=np.float32)})[0][0]
        out.append(a.astype(np.float64)); out.append(np.zeros(int(0.14 * SR)))
    return np.concatenate(out) if out else np.zeros(1)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def read_wav(path):
    with wave.open(path, "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0


# ---------------------------------------------------------------- music (bright major)
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(n, o):
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o - 4) - 9) / 12)


def pluck(f, dur, vol=1.0):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-3.5 * t)
    return vol * env * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t))


def pad(freqs, dur, vol):
    t = np.arange(int(dur * SR)) / SR
    a = min(0.5, dur / 3)
    env = np.clip(np.minimum(t / a, (dur - t) / 0.8), 0, 1)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (0.998, 1.0, 1.003):
            x += np.sin(2 * np.pi * f * det * t + random.random())
    return vol * env * x / (len(freqs) * 3)


PROG = [[("C", 3), ("E", 3), ("G", 3)], [("G", 2), ("B", 2), ("D", 3)],
        [("A", 2), ("C", 3), ("E", 3)], [("F", 2), ("A", 2), ("C", 3)]]
MEL = [[("C", 5), ("E", 5), ("G", 5), ("E", 5)], [("B", 4), ("D", 5), ("G", 5), ("D", 5)],
       [("A", 4), ("C", 5), ("E", 5), ("C", 5)], [("A", 4), ("C", 5), ("F", 5), ("A", 5)]]


def music_bed(total):
    bar = 2.6
    n = int(total * SR) + SR
    out = np.zeros(n)
    t0, i = 0.0, 0
    while t0 < total:
        ch = [freq(*x) for x in PROG[i % 4]]
        seg = pad(ch, bar + 0.4, 0.34)
        s = int(t0 * SR); e = min(n, s + len(seg)); out[s:e] += seg[:e - s]
        notes = MEL[i % 4]
        for k, nm in enumerate(notes):
            ss = int((t0 + k * bar / 4) * SR)
            if ss >= n:
                continue
            pl = pluck(freq(*nm), 0.5, 0.16)
            ee = min(n, ss + len(pl)); out[ss:ee] += pl[:ee - ss]
        t0 += bar; i += 1
    return out[:int(total * SR)]


# ---------------------------------------------------------------- palette + helpers
def hx(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


INK = (60, 54, 48)
CREAM = "#FFF6E6"


def F(sz, reg=False):
    return ImageFont.truetype(FONT_R if reg else FONT, int(sz * SS))


def T(d, xy, s, sz, fill=INK, anchor="lm", reg=False, stroke=0, sfill=(255, 255, 255)):
    d.text((xy[0] * SS, xy[1] * SS), s, font=F(sz, reg), fill=fill, anchor=anchor,
           stroke_width=int(stroke * SS), stroke_fill=sfill)


def grad(c1, c2):
    top, bot = np.array(hx(c1), float), np.array(hx(c2), float)
    col = np.linspace(top, bot, H * SS).astype(np.uint8)
    return Image.fromarray(np.repeat(col[:, None, :], W * SS, axis=1), "RGB")


def paper(img, seed=1):
    d = ImageDraw.Draw(img, "RGBA")
    r = random.Random(seed)
    for _ in range(120):
        x, y = r.randint(0, W * SS), r.randint(0, H * SS)
        d.ellipse([x, y, x + 2, y + 2], fill=(120, 100, 70, 18))
    return d


def blob(d, cx, cy, r, col, seed=1, outline=INK, n=30, wob=0.18):
    rr = random.Random(seed)
    ph = [rr.uniform(0, 6.28) for _ in range(3)]
    amp = [rr.uniform(0.06, wob) for _ in range(3)]
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        f = 1 + sum(amp[k] * math.sin((k + 2) * a + ph[k]) for k in range(3))
        pts.append(((cx + r * f * math.cos(a)) * SS, (cy + r * f * math.sin(a)) * SS))
    d.polygon(pts, fill=hx(col) if isinstance(col, str) else col,
              outline=outline, width=3 * SS)
    return pts


# ---------------------------------------------------------------- CHARACTER: Pip (6 poses)
BODY = "#46C2B4"
BODY_D = "#2F9E92"
BELLY = "#EAFBF7"
HAT = "#D9A24E"
HATBAND = "#E4572E"


def _cap(d, p, q, col, w):
    d.line([p[0] * SS, p[1] * SS, q[0] * SS, q[1] * SS], fill=col, width=int(w * SS))
    for pt in (p, q):
        r = w / 2
        d.ellipse([(pt[0] - r) * SS, (pt[1] - r) * SS, (pt[0] + r) * SS, (pt[1] + r) * SS], fill=col)


def draw_pip(d, cx, cy, pose="idle", s=1.0, t=0.0):
    """cy = ground line. Character ~ 300*s tall."""
    bob = math.sin(t * 3.0) * 5 * s if pose in ("idle", "point_side", "point_up", "think") else 0
    def P(dx, dy):
        return (cx + dx * s, cy + (dy + bob) * s)
    body_col = hx(BODY)
    # feet
    for fx in (-34, 34):
        f = P(fx, -8)
        d.ellipse([(f[0] - 26 * s) * SS, (f[1] - 14 * s) * SS, (f[0] + 26 * s) * SS, (f[1] + 12 * s) * SS],
                  fill=hx(BODY_D), outline=INK, width=3 * SS)
    # body (bean)
    bx0, by0 = P(-82, -300); bx1, by1 = P(82, -18)
    d.rounded_rectangle([bx0 * SS, by0 * SS, bx1 * SS, by1 * SS], radius=78 * SS,
                        fill=body_col, outline=INK, width=4 * SS)
    # belly
    e = P(0, -150)
    d.ellipse([(e[0] - 52 * s) * SS, (e[1] - 78 * s) * SS, (e[0] + 52 * s) * SS, (e[1] + 82 * s) * SS],
              fill=hx(BELLY))
    # face
    tilt = -8 if pose == "think" else 0
    for ex in (-32, 32):
        ey = -232
        pt = P(ex, ey + (tilt if ex < 0 else 0))
        d.ellipse([(pt[0] - 20 * s) * SS, (pt[1] - 24 * s) * SS, (pt[0] + 20 * s) * SS, (pt[1] + 24 * s) * SS],
                  fill=(255, 255, 255), outline=INK, width=3 * SS)
        look = 6 if pose in ("point_side", "wave") else (0 if pose != "think" else 5)
        pu = P(ex + look, ey + 4)
        d.ellipse([(pu[0] - 8 * s) * SS, (pu[1] - 9 * s) * SS, (pu[0] + 8 * s) * SS, (pu[1] + 9 * s) * SS], fill=INK)
    # cheeks
    for cxx in (-46, 46):
        pt = P(cxx, -200)
        d.ellipse([(pt[0] - 13 * s) * SS, (pt[1] - 8 * s) * SS, (pt[0] + 13 * s) * SS, (pt[1] + 8 * s) * SS],
                  fill=(255, 158, 148, 180))
    # mouth
    m = P(0, -196)
    if pose == "cheer":
        d.ellipse([(m[0] - 20 * s) * SS, (m[1] - 6 * s) * SS, (m[0] + 20 * s) * SS, (m[1] + 26 * s) * SS],
                  fill=hx("#7A2E2E"), outline=INK, width=3 * SS)
    else:
        d.arc([(m[0] - 22 * s) * SS, (m[1] - 18 * s) * SS, (m[0] + 22 * s) * SS, (m[1] + 16 * s) * SS],
              15, 165, fill=INK, width=4 * SS)
    # hat (pith helmet)
    hb = P(0, -292)
    d.ellipse([(hb[0] - 78 * s) * SS, (hb[1] - 8 * s) * SS, (hb[0] + 78 * s) * SS, (hb[1] + 22 * s) * SS],
              fill=hx(HAT), outline=INK, width=4 * SS)
    dome = P(0, -300)
    d.pieslice([(dome[0] - 60 * s) * SS, (dome[1] - 58 * s) * SS, (dome[0] + 60 * s) * SS, (dome[1] + 40 * s) * SS],
               180, 360, fill=hx(HAT), outline=INK, width=4 * SS)
    d.line([(dome[0] - 58 * s) * SS, (dome[1] - 6 * s) * SS, (dome[0] + 58 * s) * SS, (dome[1] - 6 * s) * SS],
           fill=hx(HATBAND), width=8 * SS)
    knob = P(0, -352)
    d.ellipse([(knob[0] - 9 * s) * SS, (knob[1] - 9 * s) * SS, (knob[0] + 9 * s) * SS, (knob[1] + 9 * s) * SS],
              fill=hx(HATBAND), outline=INK, width=2 * SS)
    # arms
    Lsh, Rsh = P(-74, -232), P(74, -232)
    aw = 26 * s
    poses = {
        "idle":       ((-104, -150), (104, -150)),
        "wave":       ((-104, -150), (118, -320)),
        "point_side": ((-98, -150), (172, -238)),
        "point_up":   ((-98, -150), (78, -372)),
        "think":      ((-98, -150), (30, -250)),
        "cheer":      ((-126, -338), (126, -338)),
    }
    (ld, rd) = poses.get(pose, poses["idle"])
    Lh = P(*ld)
    if pose == "wave":
        Rh = P(rd[0] + math.sin(t * 8) * 14, rd[1])
    else:
        Rh = P(*rd)
    _cap(d, Lsh, Lh, body_col, aw); _cap(d, Rsh, Rh, body_col, aw)
    # hands (mittens)
    for h in (Lh, Rh):
        d.ellipse([(h[0] - 17 * s) * SS, (h[1] - 17 * s) * SS, (h[0] + 17 * s) * SS, (h[1] + 17 * s) * SS],
                  fill=hx(BODY_D), outline=INK, width=3 * SS)
    # pointer stick for point poses
    if pose == "point_side":
        tip = P(250, -238); _cap(d, Rh, tip, hx("#8A5A2B"), 7 * s)
        d.ellipse([(tip[0] - 8 * s) * SS, (tip[1] - 8 * s) * SS, (tip[0] + 8 * s) * SS, (tip[1] + 8 * s) * SS], fill=hx(HATBAND))
    if pose == "point_up":
        tip = P(78, -452); _cap(d, Rh, tip, hx("#8A5A2B"), 7 * s)
        d.ellipse([(tip[0] - 8 * s) * SS, (tip[1] - 8 * s) * SS, (tip[0] + 8 * s) * SS, (tip[1] + 8 * s) * SS], fill=hx(HATBAND))


# ---------------------------------------------------------------- landscape icons
def mountain(d, cx, base, w, h, col="#8FA3AE", snow=True, houses=False):
    pts = [((cx - w) * SS, base * SS), (cx * SS, (base - h) * SS), ((cx + w) * SS, base * SS)]
    d.polygon(pts, fill=hx(col), outline=INK, width=3 * SS)
    if snow:
        sh = h * 0.32
        d.polygon([(cx * SS, (base - h) * SS), ((cx - w * 0.34) * SS, (base - h + sh) * SS),
                   ((cx - w * 0.1) * SS, (base - h + sh * 0.7) * SS), (cx * SS, (base - h + sh) * SS),
                   ((cx + w * 0.12) * SS, (base - h + sh * 0.75) * SS),
                   ((cx + w * 0.34) * SS, (base - h + sh) * SS)], fill=(255, 255, 255))
    if houses:
        rr = random.Random(3)
        for k in range(7):
            fy = base - h * 0.15 - k * (h * 0.10)
            fx = cx + (rr.uniform(-1, 1)) * (w * 0.5) * (1 - k / 9)
            d.rectangle([(fx - 9) * SS, (fy - 9) * SS, (fx + 9) * SS, fy * SS],
                        fill=hx("#E4572E"), outline=INK, width=2 * SS)


def waterlines(d, x0, x1, y, col="#2E86AB", n=3, t=0.0):
    for i in range(n):
        yy = y + i * 22
        pts = []
        x = x0
        while x <= x1:
            pts.append((x * SS, (yy + math.sin(x / 40 + t * 2 + i) * 6) * SS)); x += 12
        d.line(pts, fill=hx(col), width=4 * SS, joint="curve")


def island(d, cx, cy, r, seed, col="#7FB069"):
    blob(d, cx, cy, r, col, seed=seed, n=22, wob=0.22)
    blob(d, cx, cy - r * 0.2, r * 0.6, "#F4E1A6", seed=seed + 1, outline=None, n=18, wob=0.2)


# ---------------------------------------------------------------- scenes
def banner(d, title, tag, tcol):
    rrx = 60
    d.rounded_rectangle([rrx * SS, 70 * SS, (rrx + 40 + len(title) * 34) * SS, 158 * SS], radius=22 * SS,
                        fill=(255, 255, 255, 235), outline=INK, width=4 * SS)
    T(d, (rrx + 26, 114), title, 56, fill=tcol)
    if tag:
        tw = 40 + len(tag) * 17
        d.rounded_rectangle([rrx * SS, 172 * SS, (rrx + tw) * SS, 224 * SS], radius=16 * SS,
                            fill=(*hx(tcol), 40), outline=hx(tcol), width=3 * SS)
        T(d, (rrx + 20, 198), tag, 28, fill=hx(tcol), reg=True)


def ease(p):
    return 0.0 if p <= 0 else (1.0 if p >= 1 else 1 - (1 - p) ** 3)


def caption(d, s):
    if not s:
        return
    cf = F(34, reg=True)
    words, lines, cur = s.split(), [], ""
    while words:
        w_ = words.pop(0); tt = (cur + " " + w_).strip()
        if d.textlength(tt, font=cf) <= 1560 * SS:
            cur = tt
        else:
            lines.append(cur); cur = w_
    lines.append(cur)
    h = len(lines) * 44 + 30
    top = 1018 - h
    d.rounded_rectangle([90 * SS, top * SS, 1830 * SS, 1014 * SS], radius=18 * SS,
                        fill=(255, 255, 255, 236), outline=INK, width=3 * SS)
    y = (top + 16) * SS
    for ln in lines:
        d.text((W * SS / 2, y), ln, font=cf, fill=INK, anchor="ma"); y += 44 * SS


COUNTRIES = {
    "kravok": ("#8FA3AE", "Kravok", "the vertical kingdom"),
    "sillimar": ("#2E86AB", "Sillimar", "the thousand isles"),
    "dunmaar": ("#D98E4A", "Dunmaar", "the split desert"),
    "mirewen": ("#5E8B6A", "Mirewen", "the sunken marsh"),
    "cindral": ("#B5533C", "Cindral", "the crater country"),
}


def draw_landscape(d, key, t):
    if key == "kravok":
        mountain(d, 900, 880, 430, 620, col="#8FA3AE", houses=True)
        mountain(d, 500, 880, 220, 300, col="#A9B7BF", snow=False)
        mountain(d, 1350, 880, 260, 360, col="#A9B7BF")
        T(d, (900, 250), "capital: 5,900m", 30, fill=INK, anchor="mm", reg=True, stroke=4)
    elif key == "sillimar":
        waterlines(d, 120, 1800, 560, n=5, t=t)
        for (ix, iy, r, sd) in [(430, 560, 90, 4), (760, 640, 70, 7), (1080, 560, 100, 11),
                                (1360, 660, 60, 5), (1560, 560, 80, 9)]:
            island(d, ix, iy, r, sd)
        T(d, (960, 250), "map valid for ~20 min", 30, fill=hx("#2E86AB"), anchor="mm", stroke=4)
    elif key == "dunmaar":
        d.rectangle([120 * SS, 560 * SS, 1800 * SS, 900 * SS], fill=hx("#EBC08A"))
        for dx in (300, 560, 1300, 1600):
            d.arc([(dx - 90) * SS, 600 * SS, (dx + 90) * SS, 760 * SS], 200, 340, fill=hx("#D9A24E"), width=6 * SS)
        # canyon down the middle
        d.polygon([(900 * SS, 560 * SS), (980 * SS, 560 * SS), (1040 * SS, 900 * SS), (840 * SS, 900 * SS)],
                  fill=hx("#7A5230"), outline=INK, width=3 * SS)
        d.ellipse([(860) * SS, 860 * SS, (1020) * SS, 900 * SS], fill=(220, 220, 230, 150))  # fog
        T(d, (940, 300), "the Groove", 34, fill=hx("#7A5230"), anchor="mm", stroke=4)
    elif key == "mirewen":
        waterlines(d, 120, 1800, 720, n=6, t=t, col="#5E8B6A")
        d.rectangle([120 * SS, 470 * SS, 1800 * SS, 500 * SS], fill=hx("#8B6F47"))  # sea wall
        T(d, (960, 445), "ancient sea-wall  (sea level ↑)", 26, fill=INK, anchor="mm", reg=True, stroke=4)
        for (hx0, sd) in [(420, 1), (700, 2), (980, 3), (1260, 4), (1520, 5)]:
            # stilt hut
            d.line([(hx0 - 30) * SS, 760 * SS, (hx0 - 30) * SS, 660 * SS], fill=INK, width=4 * SS)
            d.line([(hx0 + 30) * SS, 760 * SS, (hx0 + 30) * SS, 660 * SS], fill=INK, width=4 * SS)
            d.rectangle([(hx0 - 42) * SS, 610 * SS, (hx0 + 42) * SS, 665 * SS], fill=hx("#C4A35A"), outline=INK, width=3 * SS)
            d.polygon([((hx0 - 50) * SS, 610 * SS), (hx0 * SS, 566 * SS), ((hx0 + 50) * SS, 610 * SS)],
                      fill=hx("#E4572E"), outline=INK, width=3 * SS)
    elif key == "cindral":
        d.polygon([(360 * SS, 900 * SS), (720 * SS, 380 * SS), (1200 * SS, 380 * SS), (1560 * SS, 900 * SS)],
                  fill=hx("#B5533C"), outline=INK, width=4 * SS)
        d.polygon([(720 * SS, 380 * SS), (820 * SS, 470 * SS), (1100 * SS, 470 * SS), (1200 * SS, 380 * SS)],
                  fill=hx("#7E3B2C"))
        d.ellipse([760 * SS, 560 * SS, 1160 * SS, 720 * SS], fill=hx("#3FA7D6"), outline=INK, width=4 * SS)  # lake
        for vx in (640, 1280):  # steam vents
            for k in range(3):
                d.arc([(vx - 20) * SS, (620 - k * 40) * SS, (vx + 20) * SS, (660 - k * 40) * SS], 20, 200,
                      fill=(255, 255, 255, 160), width=4 * SS)
        T(d, (960, 300), "crater lake · warm all year", 30, fill=hx("#B5533C"), anchor="mm", stroke=4)


# scene list: (kind, key/None, pose, narration)
SCENES = [
    ("intro", None, "wave",
     "Hi! I'm Pip. And this, is Vunderra. It's not a real place. That's the best part, because it means the geography gets to be as strange as we want. So grab a map, and let's take the tour."),
    ("overview", None, "point_side",
     "Vunderra is one continent, five countries, and absolutely no chill when it comes to terrain. We've got a kingdom stacked up a single mountain, a country that changes shape twice a day, and a nation that lives inside a volcano. Let's start at the top. Literally."),
    ("country", "kravok", "point_up",
     "First up: Kravok, the vertical kingdom. The entire country is built up the side of one enormous mountain. The capital city sits right at the summit, nearly six kilometers up. There are no flat streets. There is no flat anything. In Kravok, popping into town is a serious cardio event, and the national sport is, of course, stairs. Fun fact: the richest citizens all live at the bottom. Because that's where the oxygen is."),
    ("country", "sillimar", "point_side",
     "Down on the coast is Sillimar, the thousand isles. Sillimar has the most extreme tides on the whole planet. At low tide, the sea pulls back so far you can simply walk between the islands on the bare seabed. At high tide, those same paths are ten meters underwater. Which means the map of Sillimar is only correct for about twenty minutes at a time. Here, border disputes are settled by the moon."),
    ("country", "dunmaar", "think",
     "To the east lies Dunmaar, a desert nation with one big problem, running right down the middle. It's called the Groove: a canyon so deep and so wide that it has its very own weather at the bottom. Down there it's cool and foggy, while the surface bakes. The two halves of Dunmaar have been split for so long that they've drifted into different accents, different food, and one extremely long argument about who the canyon really belongs to."),
    ("country", "mirewen", "idle",
     "Further south is Mirewen, and here's the twist: the whole country sits below sea level. It's a sunken marsh, held back from the ocean by a giant ring of ancient sea-walls. Everyone lives in houses on stilts, every road is a canal, and the national vehicle is a little boat. If those walls ever fail, Mirewen doesn't pack up and move. Mirewen simply becomes a very nice reef."),
    ("country", "cindral", "cheer",
     "And finally, the strangest of them all: Cindral, a country that lives inside a volcano. Don't panic, it's dormant. A gigantic eruption thousands of years ago left behind a crater so vast that an entire nation just moved in. There's a huge freshwater lake in the middle, the crater walls block every storm, and geothermal vents keep the whole place warm and green all year round. Cindral is, basically, the coziest apocalypse in history."),
    ("outro", None, "cheer",
     "So that is Vunderra. Five countries, five gloriously unhinged geographies, and not one of them real. The big question is: which one would you actually live in? Vertical Kravok? Tidal Sillimar? Split Dunmaar? Sunken Mirewen? Or cozy little Cindral? Tell me down below. And if you'd like a whole new continent next time, well. You know what to do. I'm Pip. Watch your step."),
]


def draw_scene(d, img, kind, key, pose, t, dur):
    if kind == "intro":
        gtop = P0 = None
        T(d, (960, 250), "VUNDERRA", 130, fill=hx("#E4572E"), anchor="mm", stroke=6)
        T(d, (960, 350), "a tour of impossible geography", 44, fill=INK, anchor="mm", reg=True)
        draw_pip(d, 960, 780, "wave", 1.0, t)
    elif kind == "overview":
        # continent with 5 country blobs
        blob(d, 900, 560, 420, "#EAD9B0", seed=2, n=40, wob=0.14)
        spots = [("kravok", 720, 400, 120), ("sillimar", 1180, 430, 110),
                 ("dunmaar", 1230, 640, 120), ("mirewen", 780, 720, 120), ("cindral", 940, 560, 110)]
        for i, (k, x, y, r) in enumerate(spots):
            if ease((t - (0.4 + i * 0.4)) / 0.4) > 0:
                blob(d, x, y, r, COUNTRIES[k][0], seed=10 + i, n=24, wob=0.2)
                T(d, (x, y), COUNTRIES[k][1], 26, fill=(255, 255, 255), anchor="mm", stroke=4, sfill=INK)
        draw_pip(d, 1660, 720, "point_side", 0.64, t)
    elif kind == "country":
        col, name, tag = COUNTRIES[key]
        draw_landscape(d, key, t)
        banner(d, name, tag, col)
        draw_pip(d, 1710, 706, pose, 0.56, t)
    elif kind == "outro":
        T(d, (960, 300), "which one?", 96, fill=hx("#E4572E"), anchor="mm", stroke=6)
        names = ["Kravok", "Sillimar", "Dunmaar", "Mirewen", "Cindral"]
        cols = [COUNTRIES[k][0] for k in COUNTRIES]
        for i, (nm, c) in enumerate(zip(names, cols)):
            if ease((t - (0.5 + i * 0.3)) / 0.3) > 0:
                x = 360 + i * 300
                d.rounded_rectangle([(x - 130) * SS, 430 * SS, (x + 130) * SS, 520 * SS], radius=18 * SS,
                                    fill=(*hx(c), 60), outline=hx(c), width=3 * SS)
                T(d, (x, 475), nm, 34, fill=hx(c), anchor="mm")
        draw_pip(d, 960, 792, "cheer", 0.8, t)


def render_segment(idx, kind, key, pose, cap, dur, wav):
    nf = max(int(dur * FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS_R), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS_O), "-c:a", "aac", "-b:a", "160k",
         "-t", f"{dur:.3f}", mp4], stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    skies = {"kravok": ("#CFE8F5", "#EAF6FB"), "sillimar": ("#BFE9F0", "#EAFBFB"),
             "dunmaar": ("#FBE4B8", "#FFF6E6"), "mirewen": ("#CDE7D6", "#EFF9F1"),
             "cindral": ("#F6D3C2", "#FFF0E9")}
    sky = skies.get(key, ("#CDEAF2", "#FFF6E6"))
    base = grad(*sky)
    for fi in range(nf):
        t = fi / FPS_R
        img = base.copy()
        d = ImageDraw.Draw(img, "RGBA")
        random.seed(1)
        paper(img, seed=7)
        d = ImageDraw.Draw(img, "RGBA")
        draw_scene(d, img, kind, key, pose, t, dur)
        caption(d, cap)
        proc.stdin.write(img.resize((W, H), Image.LANCZOS).tobytes())
    proc.stdin.close(); proc.wait()
    return mp4


def main():
    seg_files, durations = [], []
    for i, (kind, key, pose, narr) in enumerate(SCENES):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        if os.path.exists(done):
            durations.append(len(read_wav(wav)) / SR)
            seg_files.append(os.path.join(OUT, f"seg{i:03d}.mp4")); continue
        v = tts(narr, speed=1.0)
        v = np.concatenate([v, np.zeros(int(0.5 * SR))])
        write_wav(wav, v); dur = len(v) / SR; durations.append(dur)
        render_segment(i, kind, key, pose, narr, dur, wav)
        open(done, "w").close()
        print(f"[{i+1}/{len(SCENES)}] {kind} {key or ''} {dur:.1f}s", flush=True)
    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{os.path.abspath(p)}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined],
                   check=True, capture_output=True)
    total = sum(durations); print(f"total {total:.1f}s", flush=True)
    write_wav(os.path.join(OUT, "bed.wav"), music_bed(total))
    final = os.path.join(OUT, "vunderra_geography.mp4")
    subprocess.run(["ffmpeg", "-y", "-i", joined, "-i", os.path.join(OUT, "bed.wav"), "-filter_complex",
                    "[1:a]volume=0.12[m];[0:a]volume=1.35[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final],
                   check=True, capture_output=True)
    print("FINAL:", final, flush=True)


# --- helper used inside draw_scene intro (defined late to avoid clutter) ---
P0 = None
if __name__ == "__main__":
    main()
