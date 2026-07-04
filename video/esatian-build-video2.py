#!/usr/bin/env python3
"""history of the esatian union, i guess — v2.

Bill wurtz style: animated flat doodle visuals (blob maps, sun, explosions,
pop-in text) + natural Kokoro TTS + generated jazz bed.
"""
import math
import os
import random
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
TTSDIR = os.path.join(BASE, "..", "ttsvoice")
OUT = os.path.join(BASE, "out2")
os.makedirs(OUT, exist_ok=True)

SR = 24000
W, H = 1920, 1080
SS = 2  # supersample factor for drawing
FPS_R = 15   # render fps
FPS_O = 30   # output fps

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# ---------------------------------------------------------------- TTS
_sess = None
_tok = None
_voices = None


def tts(text, voice="am_michael", speed=1.12):
    global _sess, _tok, _voices
    if _sess is None:
        import onnxruntime as ort
        from kokoro_onnx.tokenizer import Tokenizer
        _tok = Tokenizer()
        _sess = ort.InferenceSession(os.path.join(TTSDIR, "kokoro-model.onnx"))
        _voices = np.load(os.path.join(TTSDIR, "voices.npz"))
    ph = _tok.phonemize(text, lang="en-us")
    tokens = _tok.tokenize(ph)
    out = []
    # chunk long token sequences (model context 510)
    while tokens:
        chunk, tokens = tokens[:500], tokens[500:]
        ref = _voices[voice][len(chunk)]
        ids = np.array([[0] + chunk + [0]], dtype=np.int64)
        a = _sess.run(None, {"input_ids": ids, "style": ref.astype(np.float32),
                             "speed": np.array([speed], dtype=np.float32)})[0][0]
        out.append(a.astype(np.float64))
    return np.concatenate(out) if out else np.zeros(1)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def read_wav(path):
    with wave.open(path, "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0


# ---------------------------------------------------------------- music
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(name, octave):
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave - 4) - 9) / 12)


def ep_note(f, dur, vol=1.0):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-2.2 * t)
    return vol * env * (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
                        + 0.12 * np.sin(6 * np.pi * f * t))


def pad_chord(freqs, dur, vol=1.0):
    t = np.arange(int(dur * SR)) / SR
    a = min(0.6, dur / 3)
    env = np.minimum(t / a, 1.0) * np.exp(-0.25 * t)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (0.998, 1.0, 1.003):
            x += np.sin(2 * np.pi * f * det * t + random.random())
    return vol * env * x / (len(freqs) * 3)


CHORDS = [(("F", 2), [("F", 3), ("A", 3), ("C", 4), ("E", 4)]),
          (("A", 2), [("A", 3), ("C", 4), ("E", 4), ("G", 4)]),
          (("D", 2), [("D", 3), ("F", 3), ("A", 3), ("C", 4)]),
          (("G", 2), [("G", 3), ("B", 3), ("D", 4), ("F", 4)])]


def music_bed(total_dur):
    bar = 2.4
    n = int(total_dur * SR) + SR
    out = np.zeros(n)
    t0, i = 0.0, 0
    while t0 < total_dur:
        bass, chord = CHORDS[i % 4]
        s = int(t0 * SR)
        seg = ep_note(freq(*bass), bar, 0.5)
        end = min(n, s + len(seg))
        out[s:end] += seg[:end - s]
        for off, v in ((0.0, 0.35), (1.35, 0.22)):
            ss = int((t0 + off) * SR)
            if ss >= n:
                continue
            for nm in chord:
                sg = ep_note(freq(*nm), bar - off, v / len(chord))
                end = min(n, ss + len(sg))
                out[ss:end] += sg[:end - ss]
        t0 += bar
        i += 1
    return out[:int(total_dur * SR)]


JCHORD = [("F", 3), ("A", 3), ("C", 4), ("E", 4), ("G", 4)]

# ---------------------------------------------------------------- drawing
def hx(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def grad(c1, c2):
    top, bot = np.array(hx(c1), float), np.array(hx(c2), float)
    col = np.linspace(top, bot, H * SS).astype(np.uint8)  # H*SS x 3
    arr = np.repeat(col[:, None, :], W * SS, axis=1)
    return Image.fromarray(arr, "RGB")


def space_bg(seed=1):
    img = Image.new("RGB", (W * SS, H * SS), hx("#131333"))
    d = ImageDraw.Draw(img)
    r = random.Random(seed)
    for _ in range(240):
        x, y = r.randint(0, W * SS), r.randint(0, H * SS)
        rr = r.choice([2, 2, 3, 4, 6])
        c = r.choice([(255, 255, 255), (255, 235, 170), (185, 215, 255)])
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c)
    return img


BGS = {
    "sky": lambda: grad("#6EC6F0", "#DFF6FF"),
    "sunset": lambda: grad("#FF9A8B", "#FFD9A5"),
    "mint": lambda: grad("#7BE0C2", "#E8FFF6"),
    "lavender": lambda: grad("#B79CED", "#F1E8FF"),
    "peach": lambda: grad("#FFB4A2", "#FFE8D6"),
    "lemon": lambda: grad("#FFE066", "#FFF8D6"),
    "coral": lambda: grad("#FF6B6B", "#FFC6C6"),
    "teal": lambda: grad("#0FB5AE", "#BDF3F0"),
    "blue": lambda: grad("#4361EE", "#C0D0FF"),
    "pink": lambda: grad("#F15BB5", "#FFD6EF"),
    "space": lambda: space_bg(3),
}

NATION = {  # consistent blob colors
    "esat": "#FF5964", "barth": "#3A86FF", "nbarth": "#5EAAFF", "brit": "#C1121F",
    "france": "#7161EF", "adaz": "#FFB703", "ontana": "#6C757D", "dysk": "#495057",
    "quebec": "#9D0208", "lyance": "#06D6A0", "abbur": "#F72585", "stev": "#B5179E",
    "ollia": "#4CC9F0", "tadar": "#7F5539", "gall": "#80ED99", "galikh": "#57CC99",
    "stelk": "#FF9F1C", "niag": "#BDB2FF", "union": "#FFD60A",
}


def F(sz):
    return ImageFont.truetype(FONT, int(sz * SS))


def shadow_text(d, xy, text, sz, fill="#FFFFFF", anchor="mm", shadow=6):
    x, y = xy[0] * SS, xy[1] * SS
    off = shadow * SS / 2
    d.text((x + off, y + off), text, font=F(sz), fill=(0, 0, 0, 110), anchor=anchor)
    d.text((x, y), text, font=F(sz), fill=fill, anchor=anchor,
           stroke_width=max(2, int(sz * SS * 0.025)), stroke_fill=(20, 20, 30))


def blob_pts(cx, cy, r, seed, n=26, wob=0.24):
    rr = random.Random(seed)
    ph = [rr.uniform(0, 2 * math.pi) for _ in range(3)]
    amp = [rr.uniform(0.08, wob) for _ in range(3)]
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        f = 1 + sum(amp[k] * math.sin((k + 2) * a + ph[k]) for k in range(3))
        pts.append((cx * SS + r * SS * f * math.cos(a), cy * SS + r * SS * f * math.sin(a)))
    return pts


def draw_blob(d, cx, cy, r, color, seed=1, label=None, lsz=None, outline=True):
    pts = blob_pts(cx, cy, r, seed)
    d.polygon(pts, fill=hx(color),
              outline=(25, 25, 35) if outline else None, width=3 * SS)
    if label:
        shadow_text(d, (cx, cy), label, lsz or max(26, min(44, r * 0.42)), shadow=3)


def draw_sun(d, cx, cy, r, face=True):
    for i in range(16):
        a = 2 * math.pi * i / 16
        x1 = cx * SS + r * 1.25 * SS * math.cos(a)
        y1 = cy * SS + r * 1.25 * SS * math.sin(a)
        x2 = cx * SS + r * 1.75 * SS * math.cos(a)
        y2 = cy * SS + r * 1.75 * SS * math.sin(a)
        d.line([x1, y1, x2, y2], fill=hx("#FFC300"), width=10 * SS)
    d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS],
              fill=hx("#FFD60A"), outline=(40, 30, 0), width=3 * SS)
    if face:
        er = r * 0.09
        for ex in (cx - r * 0.32, cx + r * 0.32):
            d.ellipse([(ex - er) * SS, (cy - r * 0.22 - er) * SS,
                       (ex + er) * SS, (cy - r * 0.22 + er) * SS], fill=(40, 30, 0))
        d.arc([(cx - r * 0.4) * SS, (cy - r * 0.25) * SS,
               (cx + r * 0.4) * SS, (cy + r * 0.45) * SS], 20, 160,
              fill=(40, 30, 0), width=6 * SS)


def draw_earth(d, cx, cy, r):
    d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS],
              fill=hx("#2D82B7"), outline=(15, 15, 25), width=3 * SS)
    rr = random.Random(9)
    for _ in range(5):
        bx = cx + rr.uniform(-r * 0.5, r * 0.5)
        by = cy + rr.uniform(-r * 0.5, r * 0.5)
        draw_blob(d, bx, by, r * rr.uniform(0.18, 0.3), "#43AA8B",
                  seed=rr.randint(1, 99), outline=False)


def draw_burst(d, cx, cy, r, c1="#FF3B00", c2="#FFC300", label=None):
    pts = []
    for i in range(24):
        a = 2 * math.pi * i / 24
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx * SS + rad * SS * math.cos(a), cy * SS + rad * SS * math.sin(a)))
    d.polygon(pts, fill=hx(c1), outline=(30, 10, 0), width=3 * SS)
    pts2 = [((p[0] - cx * SS) * 0.55 + cx * SS, (p[1] - cy * SS) * 0.55 + cy * SS) for p in pts]
    d.polygon(pts2, fill=hx(c2))
    if label:
        shadow_text(d, (cx, cy), label, max(20, r * 0.3), shadow=3)


def draw_flag(d, cx, cy, hgt, color, x_out=False):
    d.line([cx * SS, cy * SS, cx * SS, (cy - hgt) * SS], fill=(50, 40, 30), width=6 * SS)
    d.rectangle([cx * SS, (cy - hgt) * SS, (cx + hgt * 0.62) * SS, (cy - hgt * 0.62) * SS],
                fill=hx(color), outline=(25, 25, 35), width=3 * SS)
    if x_out:
        a, b = (cx - hgt * 0.15), (cy - hgt * 1.1)
        c, e = (cx + hgt * 0.75), (cy - hgt * 0.5)
        d.line([a * SS, b * SS, c * SS, e * SS], fill=hx("#D00000"), width=10 * SS)
        d.line([a * SS, e * SS, c * SS, b * SS], fill=hx("#D00000"), width=10 * SS)


def draw_fish(d, cx, cy, r, color="#FF9F1C"):
    d.ellipse([(cx - r) * SS, (cy - r * 0.55) * SS, (cx + r) * SS, (cy + r * 0.55) * SS],
              fill=hx(color), outline=(25, 25, 35), width=3 * SS)
    d.polygon([(cx + r * 0.8) * SS, cy * SS, (cx + r * 1.5) * SS, (cy - r * 0.6) * SS,
               (cx + r * 1.5) * SS, (cy + r * 0.6) * SS], fill=hx(color),
              outline=(25, 25, 35), width=3 * SS)
    er = r * 0.1
    d.ellipse([(cx - r * 0.45 - er) * SS, (cy - r * 0.15 - er) * SS,
               (cx - r * 0.45 + er) * SS, (cy - r * 0.15 + er) * SS], fill=(20, 20, 20))
    d.arc([(cx - r * 0.35) * SS, (cy - r * 0.1) * SS, (cx + r * 0.1) * SS,
           (cy + r * 0.35) * SS], 30, 150, fill=(20, 20, 20), width=4 * SS)


def draw_crown(d, cx, cy, w_):
    h_ = w_ * 0.6
    pts = [(cx - w_ / 2, cy), (cx - w_ / 2, cy - h_ * 0.55), (cx - w_ * 0.25, cy - h_ * 0.2),
           (cx, cy - h_), (cx + w_ * 0.25, cy - h_ * 0.2), (cx + w_ / 2, cy - h_ * 0.55),
           (cx + w_ / 2, cy)]
    d.polygon([(p[0] * SS, p[1] * SS) for p in pts], fill=hx("#FFD60A"),
              outline=(60, 45, 0), width=3 * SS)


def draw_arrow(d, x1, y1, x2, y2, color="#222233", wdt=10):
    d.line([x1 * SS, y1 * SS, x2 * SS, y2 * SS], fill=hx(color), width=wdt * SS)
    a = math.atan2(y2 - y1, x2 - x1)
    L = 28
    for da in (2.6, -2.6):
        d.line([x2 * SS, y2 * SS, (x2 + L * math.cos(a + da)) * SS,
                (y2 + L * math.sin(a + da)) * SS], fill=hx(color), width=wdt * SS)


def draw_scroll(d, cx, cy, w_, h_):
    d.rounded_rectangle([(cx - w_ / 2) * SS, (cy - h_ / 2) * SS,
                         (cx + w_ / 2) * SS, (cy + h_ / 2) * SS], radius=14 * SS,
                        fill=hx("#FFF3D6"), outline=(90, 70, 30), width=4 * SS)
    for i in range(4):
        yy = cy - h_ / 2 + h_ * (0.25 + 0.17 * i)
        d.line([(cx - w_ * 0.36) * SS, yy * SS, (cx + w_ * 0.36) * SS, yy * SS],
               fill=(140, 115, 70), width=5 * SS)


RAINBOW = ["#FF5964", "#FF9F1C", "#FFD60A", "#06D6A0", "#4CC9F0", "#B79CED"]


def rainbow_text(d, cx, cy, text, sz):
    font = F(sz)
    total = d.textlength(text, font=font)
    x = cx * SS - total / 2
    for i, ch in enumerate(text):
        w_ = d.textlength(ch, font=font)
        d.text((x + 4 * SS, cy * SS + 4 * SS), ch, font=font, fill=(0, 0, 0, 120), anchor="lm")
        d.text((x, cy * SS), ch, font=font, fill=hx(RAINBOW[i % 6]), anchor="lm",
               stroke_width=2 * SS, stroke_fill=(25, 25, 35))
        x += w_


# ---------------------------------------------------------------- scenes
# element: (t0_frac, kind, args dict). Elements pop-in with overshoot.
def ease_pop(p):
    if p >= 1:
        return 1.0
    if p < 0.75:
        return 1.18 * (p / 0.75) ** 2
    return 1.18 - 0.18 * (p - 0.75) / 0.25


def E(t0, kind, **kw):
    return (t0, kind, kw)


def render_element(d, img, kind, kw, scale):
    if scale <= 0.01:
        return
    def sc(v):
        return v * scale
    if kind == "text":
        shadow_text(d, (kw["x"], kw["y"]), kw["s"], sc(kw.get("sz", 92)),
                    fill=kw.get("fill", "#FFFFFF"))
    elif kind == "rainbow":
        rainbow_text(d, kw["x"], kw["y"], kw["s"], sc(kw.get("sz", 100)))
    elif kind == "blob":
        draw_blob(d, kw["x"], kw["y"], sc(kw["r"]), kw["c"], seed=kw.get("seed", 1),
                  label=kw.get("label"), lsz=kw.get("lsz"))
    elif kind == "sun":
        draw_sun(d, kw["x"], kw["y"], sc(kw["r"]))
    elif kind == "earth":
        draw_earth(d, kw["x"], kw["y"], sc(kw["r"]))
    elif kind == "burst":
        draw_burst(d, kw["x"], kw["y"], sc(kw["r"]), label=kw.get("label"))
    elif kind == "flag":
        draw_flag(d, kw["x"], kw["y"], sc(kw["h"]), kw["c"], x_out=kw.get("x_out", False))
    elif kind == "fish":
        draw_fish(d, kw["x"], kw["y"], sc(kw["r"]))
    elif kind == "crown":
        draw_crown(d, kw["x"], kw["y"], sc(kw["w"]))
    elif kind == "arrow":
        draw_arrow(d, kw["x1"], kw["y1"], kw["x2"], kw["y2"])
    elif kind == "scroll":
        draw_scroll(d, kw["x"], kw["y"], sc(kw["w"]), sc(kw["h"]))


def caption(d, text):
    if not text:
        return
    cf = F(38)
    words, lines, cur = text.lower().split(), [], ""
    while words:
        w_ = words.pop(0)
        t = (cur + " " + w_).strip()
        if d.textlength(t, font=cf) <= 1620 * SS:
            cur = t
        else:
            lines.append(cur)
            cur = w_
    lines.append(cur)
    y = (1006 - len(lines) * 50) * SS
    for ln in lines:
        d.text((W * SS / 2, y), ln, font=cf, fill=(255, 255, 255), anchor="ma",
               stroke_width=3 * SS, stroke_fill=(0, 0, 0))
        y += 50 * SS


def render_segment_video(idx, bg, elements, cap, dur, wav_path):
    nf = max(int(dur * FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS_R), "-i", "-", "-i", wav_path,
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", "-r", str(FPS_O),
         "-c:a", "aac", "-b:a", "160k", "-t", f"{dur:.3f}", mp4],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bg_img = BGS[bg]()
    for fi in range(nf):
        t = fi / FPS_R
        img = bg_img.copy()
        d = ImageDraw.Draw(img, "RGBA")
        for (t0, kind, kw) in elements:
            start = t0 * dur if t0 < 1 else t0  # frac or abs seconds
            p = (t - start) / 0.4
            if p < 0:
                continue
            render_element(d, img, kind, kw, ease_pop(min(p, 1.0)))
        caption(d, cap)
        frame = img.resize((W, H), Image.LANCZOS)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    return mp4


# ---------------------------------------------------------------- content
# (kind, tts, caption, bg, elements)
def title(s, sub=None, y=430):
    els = [E(0.0, "text", x=960, y=y, s=s, sz=110)]
    if sub:
        els.append(E(0.25, "text", x=960, y=y + 150, s=sub, sz=54, fill="#FFF3B0"))
    return els


def century_map(*blobs, extras=()):
    els = [E(0.06 + 0.11 * i, "blob", x=b[1], y=b[2], r=b[3], c=b[4],
             seed=17 + i * 7, label=b[0]) for i, b in enumerate(blobs)]
    els += list(extras)
    return els


SEGS = [
    # --- part 1: the beginning
    ("n", "hi. you're on a peninsula, in the esatian region. it's 1375, and nothing here has a flag yet.",
     "sky", [E(0.0, "sun", x=1560, y=200, r=120),
             E(0.15, "blob", x=820, y=620, r=270, c="#43AA8B", seed=4, label="the esatian region"),
             E(0.55, "flag", x=1250, y=560, h=110, c="#EEEEEE", x_out=True)]),
    ("n", "these guys called Dyskonturahulaven and Ontanaven colonize a huge amount of land. which sounds impressive,",
     "sky", century_map(("dyskonturahulaven", 620, 480, 250, NATION["dysk"]),
                        ("ontanaven", 1330, 640, 200, "#7A7A8C"))),
    ("n", "until they collapse, 58 years later. bye.",
     "sky", [E(0.0, "blob", x=620, y=480, r=250, c=NATION["dysk"], seed=17, label="dyskonturahulaven"),
             E(0.0, "blob", x=1330, y=640, r=200, c="#7A7A8C", seed=24, label="ontanaven"),
             E(0.3, "burst", x=620, y=480, r=170, label="gone"),
             E(0.45, "burst", x=1330, y=640, r=150, label="also gone")]),
    ("n", "it's 1487. a tribe called the Esat starts a colony on the west lyantic peninsula,",
     "mint", [E(0.0, "text", x=960, y=200, s="1487", sz=100),
              E(0.2, "blob", x=900, y=620, r=230, c=NATION["esat"], seed=8, label="the esat tribe")]),
    ("n", "and immediately brands itself as an EMPIRE. confidence. love that.",
     "mint", [E(0.0, "blob", x=900, y=620, r=230, c=NATION["esat"], seed=8, label="esatic empire"),
              E(0.25, "crown", x=900, y=430, w=180),
              E(0.5, "text", x=1430, y=350, s="confidence.", sz=64, fill="#FFF3B0")]),
    ("n", "meanwhile the barths beat up a place called birgelzt, and also become an empire. because apparently that's just what you did back then.",
     "peach", [E(0.0, "blob", x=650, y=580, r=240, c=NATION["barth"], seed=12, label="barthic empire"),
               E(0.2, "blob", x=1350, y=640, r=160, c="#A98467", seed=5, label="birgelzt"),
               E(0.4, "burst", x=1350, y=640, r=120),
               E(0.6, "crown", x=650, y=380, w=170)]),
    ("j", "you could make an empire, out of this.",
     "space", [E(0.0, "rainbow", x=960, y=470, s="you could make an empire", sz=92),
               E(0.12, "rainbow", x=960, y=610, s="out of this", sz=92)]),
    ("n", "1678: the barthic empire eats the esatic empire. not violently. administratively.",
     "peach", [E(0.0, "text", x=960, y=180, s="1678", sz=90),
               E(0.1, "blob", x=830, y=600, r=290, c=NATION["barth"], seed=12, label="barthic empire"),
               E(0.45, "blob", x=1000, y=650, r=120, c=NATION["esat"], seed=8, label="esatic"),
               E(0.7, "text", x=1430, y=380, s="*administratively", sz=52, fill="#FFF3B0")]),
    # --- part 2: the british
    ("n", "1703: the british and the french discover the new world. which was already there.",
     "blue", [E(0.0, "text", x=960, y=170, s="1703", sz=90),
              E(0.15, "earth", x=700, y=600, r=260),
              E(0.4, "flag", x=1250, y=520, h=100, c=NATION["brit"]),
              E(0.55, "flag", x=1400, y=620, h=100, c=NATION["france"]),
              E(0.75, "text", x=1420, y=330, s='"discovered"', sz=64, fill="#FFF3B0")]),
    ("n", "the north says, we'll be british. and the south says, we'll also be british. bold strategy.",
     "blue", [E(0.0, "blob", x=800, y=420, r=190, c=NATION["adaz"], seed=31, label="the north"),
              E(0.2, "blob", x=880, y=760, r=190, c=NATION["esat"], seed=32, label="the south"),
              E(0.45, "flag", x=1050, y=350, h=90, c=NATION["brit"]),
              E(0.6, "flag", x=1130, y=700, h=90, c=NATION["brit"]),
              E(0.8, "text", x=1480, y=540, s="bold strategy", sz=56, fill="#FFF3B0")]),
    ("n", "the british and the barths set up a joint colony in india, to quote, negotiate resources. which is a nice way of saying something way worse.",
     "sunset", [E(0.0, "blob", x=960, y=620, r=230, c="#E9C46A", seed=44, label="joint colony"),
                E(0.3, "flag", x=780, y=480, h=90, c=NATION["brit"]),
                E(0.45, "flag", x=1150, y=480, h=90, c=NATION["barth"]),
                E(0.7, "text", x=960, y=220, s='"negotiate resources"', sz=70)]),
    ("n", "1735: britain declares war on congrave.",
     "coral", [E(0.0, "text", x=960, y=190, s="1735", sz=90),
               E(0.2, "flag", x=640, y=650, h=130, c=NATION["brit"]),
               E(0.4, "burst", x=1250, y=580, r=180, label="war")]),
    ("n", "the esatian colonies look at their maintenance budget, see that it's zero, and revolt.",
     "coral", [E(0.0, "scroll", x=760, y=540, w=520, h=380),
               E(0.25, "text", x=760, y=470, s="maintenance budget:", sz=48, fill="#5A4630"),
               E(0.4, "text", x=760, y=580, s="$0", sz=110, fill="#D00000"),
               E(0.65, "burst", x=1400, y=560, r=170, label="revolt")]),
    ("n", "the barthic empire has a civil war about slavery, then declares war on britain. and the king of britain does not handle it well. at all. rest in peace, king thomas.",
     "sunset", [E(0.0, "blob", x=700, y=640, r=240, c=NATION["barth"], seed=12, label="barthic empire"),
                E(0.2, "burst", x=620, y=400, r=125, label="civil war"),
                E(0.45, "arrow", x1=950, y1=500, x2=1330, y2=430),
                E(0.5, "flag", x=1400, y=520, h=110, c=NATION["brit"]),
                E(0.75, "crown", x=1450, y=730, w=140),
                E(0.85, "text", x=1450, y=800, s="rip king thomas", sz=46, fill="#FFF3B0")]),
    ("n", "1752: the barthic empire snaps in half. north barths. south barths. classic.",
     "lavender", [E(0.0, "text", x=960, y=170, s="1752", sz=90),
                  E(0.2, "blob", x=850, y=430, r=190, c=NATION["nbarth"], seed=51, label="north barths"),
                  E(0.4, "blob", x=920, y=780, r=190, c=NATION["barth"], seed=52, label="south barths"),
                  E(0.7, "text", x=1480, y=600, s="classic", sz=60, fill="#FFF3B0")]),
    ("n", "1776: the poor people of the barthic empire have had ENOUGH, do a whole poverty rebellion, and accidentally invent a country. the esatic union.",
     "lemon", [E(0.0, "text", x=960, y=160, s="1776", sz=100, fill="#5A4630"),
               E(0.2, "burst", x=640, y=560, r=180, label="rebellion"),
               E(0.5, "arrow", x1=850, y1=560, x2=1120, y2=560),
               E(0.6, "blob", x=1370, y=580, r=220, c=NATION["union"], seed=61, label="esatic union", lsz=48)]),
    ("n", "south barths, barthstevs, stelantins. everybody in the pool.",
     "lemon", [E(0.0, "blob", x=1370, y=580, r=240, c=NATION["union"], seed=61),
               E(0.1, "blob", x=1300, y=500, r=95, c=NATION["barth"], seed=71, label="s. barths", lsz=30),
               E(0.3, "blob", x=1470, y=620, r=95, c=NATION["stev"], seed=72, label="barthstevs", lsz=28),
               E(0.5, "blob", x=1290, y=700, r=90, c=NATION["stelk"], seed=73, label="stelantins", lsz=28),
               E(0.75, "text", x=600, y=500, s="everybody", sz=80),
               E(0.85, "text", x=600, y=610, s="in the pool", sz=80)]),
    ("j", "you could make a union, out of this.",
     "space", [E(0.0, "rainbow", x=960, y=470, s="you could make a union", sz=96),
               E(0.12, "rainbow", x=960, y=610, s="out of this", sz=96)]),
    ("n", "1788: they rename themselves the ESATIAN union. because that's what the british had been calling them anyway. and honestly? the branding was better.",
     "mint", [E(0.0, "text", x=960, y=300, s="esatic union", sz=90),
              E(0.3, "arrow", x1=960, y1=400, x2=960, y2=520),
              E(0.45, "text", x=960, y=630, s="esatian union", sz=110, fill="#FFD60A"),
              E(0.8, "text", x=1460, y=300, s="better branding", sz=50, fill="#FFF3B0")]),
    # --- part 3: everybody joins
    ("n", "now watch this.", "teal", [E(0.0, "text", x=960, y=500, s="now watch this", sz=110)]),
    ("n", "1803: north barthia joins.",
     "teal", [E(0.0, "blob", x=900, y=600, r=260, c=NATION["union"], seed=61, label="esatian union", lsz=52),
              E(0.35, "blob", x=1250, y=430, r=130, c=NATION["nbarth"], seed=51, label="+ north barthia", lsz=34)]),
    ("n", "1845: abburan joins, and renames itself abburania. very cute.",
     "teal", [E(0.0, "blob", x=900, y=600, r=260, c=NATION["union"], seed=61, label="esatian union", lsz=52),
              E(0.0, "blob", x=1250, y=430, r=130, c=NATION["nbarth"], seed=51),
              E(0.3, "blob", x=1330, y=690, r=140, c=NATION["abbur"], seed=81, label="+ abburania", lsz=34),
              E(0.7, "text", x=1520, y=880, s="very cute", sz=48, fill="#FFF3B0")]),
    ("n", "1900: ontana declares war, because the union WOULDN'T declare war on dyskonture. that's right. they got attacked, for being too peaceful. incredible.",
     "sunset", [E(0.0, "text", x=960, y=160, s="1900", sz=90),
                E(0.1, "blob", x=1350, y=560, r=200, c=NATION["ontana"], seed=91, label="ontana"),
                E(0.3, "arrow", x1=1150, y1=560, x2=880, y2=580),
                E(0.4, "blob", x=650, y=600, r=210, c=NATION["union"], seed=61, label="esatian union", lsz=44),
                E(0.65, "burst", x=880, y=580, r=120, label="war"),
                E(0.85, "text", x=650, y=330, s="too peaceful", sz=56, fill="#FFF3B0")]),
    ("n", "1902: lyance BUYS an entire colony from the british, called new warmth. and renames it nuswarm. which is the same thing, but faster.",
     "blue", [E(0.0, "blob", x=700, y=560, r=190, c=NATION["lyance"], seed=101, label="lyance"),
              E(0.25, "text", x=1050, y=420, s="$$$", sz=80, fill="#FFD60A"),
              E(0.35, "arrow", x1=950, y1=560, x2=1230, y2=560),
              E(0.45, "blob", x=1400, y=580, r=170, c="#F4A261", seed=102, label="new warmth"),
              E(0.75, "text", x=1400, y=790, s="-> nuswarm (faster)", sz=48, fill="#FFF3B0")]),
    ("n", "1904: ollia, stevia, new georgia and lyance all join at once, to fight ontana.",
     "teal", [E(0.0, "blob", x=850, y=600, r=280, c=NATION["union"], seed=61, label="esatian union", lsz=56),
              E(0.25, "blob", x=1230, y=420, r=110, c=NATION["ollia"], seed=111, label="+ ollia", lsz=30),
              E(0.4, "blob", x=1330, y=600, r=110, c=NATION["stev"], seed=112, label="+ stevia", lsz=30),
              E(0.55, "blob", x=1290, y=780, r=105, c="#90BE6D", seed=113, label="+ new georgia", lsz=26),
              E(0.7, "blob", x=1130, y=870, r=105, c=NATION["lyance"], seed=114, label="+ lyance", lsz=30)]),
    ("n", "1911: adazons, niagara, new haven. also in. this union is a black hole, and countries are the light.",
     "space", [E(0.0, "blob", x=880, y=560, r=270, c=NATION["union"], seed=61, label="esatian union", lsz=54),
               E(0.2, "blob", x=1280, y=400, r=110, c=NATION["adaz"], seed=121, label="+ adazons", lsz=30),
               E(0.35, "blob", x=1360, y=590, r=100, c=NATION["niag"], seed=122, label="+ niagara", lsz=28),
               E(0.5, "blob", x=1290, y=770, r=100, c="#CDB4DB", seed=123, label="+ new haven", lsz=26),
               E(0.75, "text", x=560, y=280, s="*black hole", sz=54, fill="#FFF3B0")]),
    ("n", "1946: ontana is finally defeated. it took 46 years. nobody talks about that.",
     "sunset", [E(0.0, "text", x=960, y=170, s="1946", sz=90),
                E(0.15, "blob", x=1300, y=580, r=190, c=NATION["ontana"], seed=91, label="ontana"),
                E(0.4, "burst", x=1300, y=580, r=150, label="defeated"),
                E(0.7, "text", x=620, y=520, s="46 years.", sz=76),
                E(0.85, "text", x=620, y=630, s="nobody talks about that", sz=46, fill="#FFF3B0")]),
    ("n", "1955: gallanter and galikh, two provinces that supported pacifism, escape ontana and join the union. the pacifists won a war. think about it. don't think about it too hard.",
     "mint", [E(0.0, "blob", x=820, y=600, r=260, c=NATION["union"], seed=61, label="esatian union", lsz=52),
              E(0.25, "blob", x=1230, y=480, r=120, c=NATION["gall"], seed=131, label="+ gallanter", lsz=30),
              E(0.4, "blob", x=1310, y=700, r=115, c=NATION["galikh"], seed=132, label="+ galikh", lsz=30),
              E(0.65, "text", x=1500, y=280, s="pacifists: 1", sz=54, fill="#2B2D42"),
              E(0.8, "text", x=1500, y=350, s="war: 0", sz=54, fill="#2B2D42")]),
    # --- part 4: government
    ("n", "quick intermission. how does this thing even work?",
     "lavender", [E(0.0, "text", x=960, y=460, s="intermission", sz=120),
                  E(0.4, "text", x=960, y=620, s="(how does this thing even work?)", sz=52, fill="#FFF3B0")]),
    ("n", "there's the GERIG, who represents everyone, and enacts the bills.",
     "lavender", [E(0.0, "crown", x=960, y=380, w=200),
                  E(0.15, "text", x=960, y=480, s="the gerig", sz=100),
                  E(0.5, "text", x=960, y=630, s="represents everyone · enacts the bills", sz=48, fill="#FFF3B0")]),
    ("n", "there's the SOTONIC branch, which makes national bills. and the MODELIC branch, which is just for barthia. because barthia is the homeland, and gets special stuff.",
     "lavender", [E(0.0, "text", x=600, y=420, s="sotonic branch", sz=70),
                  E(0.15, "text", x=600, y=520, s="national bills", sz=44, fill="#FFF3B0"),
                  E(0.4, "text", x=1330, y=420, s="modelic branch", sz=70),
                  E(0.55, "text", x=1330, y=520, s="barthia only (special)", sz=44, fill="#FFF3B0")]),
    ("n", "the constitution says: no wars inside you, no wars outside you, and absolutely no tyranny. tyranny is defined in the document. they wrote it down. it's article two.",
     "peach", [E(0.0, "scroll", x=960, y=540, w=640, h=480),
               E(0.25, "text", x=960, y=400, s="the constitution", sz=54, fill="#5A4630"),
               E(0.45, "text", x=960, y=510, s="no wars inside you", sz=44, fill="#5A4630"),
               E(0.6, "text", x=960, y=580, s="no wars outside you", sz=44, fill="#5A4630"),
               E(0.75, "text", x=960, y=660, s="absolutely no tyranny (art. II)", sz=44, fill="#B23A48")]),
    ("j", "constitutional.",
     "space", [E(0.0, "rainbow", x=960, y=540, s="constitutional", sz=130)]),
    ("n", "some gerig highlights.",
     "pink", [E(0.0, "text", x=960, y=500, s="gerig highlights", sz=110)]),
    ("n", "khabora dagilidan. amazing hunter. skilled craftsman. ate his wife. moving on.",
     "pink", [E(0.0, "text", x=960, y=300, s="khabora dagilidan", sz=90),
              E(0.25, "text", x=960, y=470, s="amazing hunter ✓", sz=54, fill="#FFF3B0"),
              E(0.4, "text", x=960, y=560, s="skilled craftsman ✓", sz=54, fill="#FFF3B0"),
              E(0.6, "text", x=960, y=660, s="ate his wife ✗", sz=54, fill="#D00000"),
              E(0.85, "text", x=1480, y=820, s="moving on", sz=48)]),
    ("n", "dexter robins gave the entire state of lyance to HIS wife, for a month, as a birthday present. and tried to make a national dance called the wiggle, legally mandatory. historians describe him as, ultimately harmless.",
     "pink", [E(0.0, "text", x=960, y=280, s="dexter robins", sz=90),
              E(0.2, "blob", x=650, y=620, r=170, c=NATION["lyance"], seed=101, label="lyance"),
              E(0.35, "text", x=650, y=830, s="(birthday present)", sz=42, fill="#FFF3B0"),
              E(0.55, "text", x=1300, y=560, s="the wiggle", sz=80, fill="#FFD60A"),
              E(0.7, "text", x=1300, y=670, s="(legally mandatory)", sz=44, fill="#FFF3B0"),
              E(0.9, "text", x=1300, y=800, s='"ultimately harmless"', sz=44)]),
    ("n", "sutlam arkas had a two hundred thousand green bounty on his head, and was assassinated by a hitman, who split the money with his boss. fifty fifty. fair is fair.",
     "pink", [E(0.0, "text", x=960, y=280, s='sutlam "the target" arkas', sz=84),
              E(0.3, "text", x=960, y=470, s="bounty: 200,000 {g}", sz=70, fill="#FFD60A"),
              E(0.6, "text", x=700, y=650, s="hitman: 50%", sz=54, fill="#FFF3B0"),
              E(0.75, "text", x=1220, y=650, s="boss: 50%", sz=54, fill="#FFF3B0"),
              E(0.9, "text", x=960, y=800, s="fair is fair", sz=48)]),
    ("n", "and mila lenking, esatia's only queen, ended a whole war, and became a symbol of feminism. legend.",
     "pink", [E(0.0, "crown", x=960, y=320, w=190),
              E(0.15, "text", x=960, y=430, s="mila lenking", sz=96),
              E(0.4, "text", x=960, y=570, s="esatia's only queen", sz=54, fill="#FFF3B0"),
              E(0.65, "text", x=960, y=670, s="ended a whole war · legend", sz=54, fill="#FFF3B0")]),
    # --- part 5: quebec
    ("n", "1967: a women's rights movement reaches quebec. and the president of quebec responds by killing hundreds of protestors. many of them, ethnic esatians.",
     "sunset", [E(0.0, "text", x=960, y=170, s="1967", sz=90),
                E(0.15, "blob", x=1250, y=560, r=210, c=NATION["quebec"], seed=141, label="quebec"),
                E(0.5, "text", x=600, y=520, s="it's bad.", sz=80)]),
    ("n", "the union steps in. the union loses. quebec takes a whole province.",
     "sunset", [E(0.0, "blob", x=650, y=600, r=220, c=NATION["union"], seed=61, label="esatian union", lsz=46),
                E(0.2, "arrow", x1=880, y1=560, x2=1130, y2=540),
                E(0.3, "blob", x=1330, y=560, r=200, c=NATION["quebec"], seed=141, label="quebec"),
                E(0.55, "burst", x=1100, y=550, r=110),
                E(0.75, "blob", x=1180, y=760, r=95, c="#E9C46A", seed=142, label="sylvestria", lsz=26),
                E(0.85, "arrow", x1=1180, y1=700, x2=1290, y2=640)]),
    ("n", "esatia surrenders, and adds a constitutional amendment that says: we are literally never declaring war again.",
     "sunset", [E(0.0, "scroll", x=960, y=540, w=680, h=420),
                E(0.3, "text", x=960, y=430, s="amendment:", sz=54, fill="#5A4630"),
                E(0.5, "text", x=960, y=560, s="we are literally never", sz=58, fill="#B23A48"),
                E(0.65, "text", x=960, y=640, s="declaring war again", sz=58, fill="#B23A48")]),
    ("j", "never declaring war, agaaain.",
     "space", [E(0.0, "rainbow", x=960, y=470, s="never declaring war", sz=100),
               E(0.12, "rainbow", x=960, y=610, s="agaaain", sz=100)]),
    ("n", "2020: quebec comes back for round two, over a territorial dispute. this time, esatia WINS. and gains babalra.",
     "teal", [E(0.0, "text", x=960, y=170, s="2020", sz=90),
              E(0.1, "blob", x=1300, y=540, r=190, c=NATION["quebec"], seed=141, label="quebec"),
              E(0.3, "text", x=1300, y=320, s="round 2", sz=56, fill="#FFF3B0"),
              E(0.45, "blob", x=650, y=600, r=230, c=NATION["union"], seed=61, label="esatian union", lsz=48),
              E(0.65, "burst", x=1050, y=560, r=110, label="win"),
              E(0.85, "blob", x=980, y=800, r=100, c="#F4A261", seed=151, label="+ babalra", lsz=28)]),
    ("n", "the amendment said they can't DECLARE wars. it said nothing, about winning them.",
     "teal", [E(0.0, "text", x=960, y=420, s="can't declare wars*", sz=96),
              E(0.4, "text", x=960, y=600, s="*winning them is fine", sz=64, fill="#FFF3B0")]),
    # --- part 6: speedrun
    ("n", "2021: adazonia holds a referendum, and nis adazon becomes independent, for approximately one afternoon, before joining the union.",
     "lemon", [E(0.0, "text", x=960, y=170, s="2021", sz=90, fill="#5A4630"),
               E(0.15, "blob", x=700, y=560, r=200, c=NATION["adaz"], seed=121, label="adazonia"),
               E(0.4, "blob", x=1150, y=620, r=120, c="#FFC93C", seed=161, label="nis adazon", lsz=30),
               E(0.6, "text", x=1150, y=430, s="independent for 1 afternoon", sz=44, fill="#5A4630"),
               E(0.8, "arrow", x1=1270, y1=620, x2=1470, y2=620),
               E(0.9, "blob", x=1600, y=620, r=110, c=NATION["union"], seed=61, label="union", lsz=32)]),
    ("n", "2022: dyskonture joins the union. 2023: dyskonture is kicked OUT of the union, for corruption, and violence. shortest membership in history. we hardly knew you. we did know you, actually. that was the problem.",
     "sky", [E(0.0, "blob", x=850, y=600, r=250, c=NATION["union"], seed=61, label="esatian union", lsz=50),
             E(0.15, "blob", x=1270, y=520, r=130, c=NATION["dysk"], seed=171, label="+ dyskonture", lsz=30),
             E(0.45, "burst", x=1270, y=520, r=110, label="kicked"),
             E(0.65, "arrow", x1=1330, y1=520, x2=1580, y2=460),
             E(0.85, "text", x=1500, y=760, s="we knew you too well", sz=44, fill="#FFF3B0")]),
    ("n", "also 2023: tadar declares war on the union, over religion. and stelan and the barthstevs fuse into one nation, called stelkizade. like it's an anime.",
     "sky", [E(0.0, "blob", x=1350, y=580, r=180, c=NATION["tadar"], seed=181, label="tadar"),
             E(0.2, "arrow", x1=1170, y1=580, x2=930, y2=590),
             E(0.3, "burst", x=900, y=590, r=110, label="war"),
             E(0.5, "blob", x=560, y=430, r=110, c=NATION["stelk"], seed=182, label="stelan", lsz=30),
             E(0.6, "blob", x=560, y=720, r=110, c=NATION["stev"], seed=183, label="barthstevs", lsz=28),
             E(0.8, "blob", x=590, y=575, r=150, c="#FF9F1C", seed=184, label="stelkizade", lsz=36),
             E(0.92, "text", x=590, y=330, s="fusion!!", sz=54, fill="#FFF3B0")]),
    ("n", "2024: tadar loses. hard. most of their territory goes to esatia, and a european nation called hisheda. atharas and ijalia are liberated.",
     "mint", [E(0.0, "text", x=960, y=170, s="2024", sz=90),
              E(0.1, "blob", x=1300, y=560, r=170, c=NATION["tadar"], seed=181, label="tadar"),
              E(0.3, "burst", x=1300, y=560, r=140, label="loses. hard."),
              E(0.55, "blob", x=700, y=560, r=210, c=NATION["union"], seed=61, label="esatian union", lsz=44),
              E(0.75, "blob", x=1050, y=800, r=95, c="#90BE6D", seed=191, label="atharas", lsz=26),
              E(0.85, "blob", x=1260, y=820, r=95, c="#4CC9F0", seed=192, label="ijalia", lsz=28)]),
    ("n", "the gerig who did it, lorvan madin, is considered a hero. and he's still in charge, right now.",
     "lemon", [E(0.0, "crown", x=960, y=330, w=190),
               E(0.15, "text", x=960, y=440, s="lorvan madin", sz=96, fill="#5A4630"),
               E(0.45, "text", x=960, y=590, s="hero · still in charge right now", sz=54, fill="#5A4630")]),
    ("n", "so, that's the esatian union. eighteen nations. fifty million people. three branches. two religions. one cannibal. and a constitution that technically prevents war. and statistically, does not.",
     "sky", [E(0.0, "blob", x=700, y=560, r=260, c=NATION["union"], seed=61, label="esatian union", lsz=52),
             E(0.2, "text", x=1400, y=300, s="18 nations", sz=58),
             E(0.33, "text", x=1400, y=390, s="50,000,000 people", sz=58),
             E(0.46, "text", x=1400, y=480, s="3 branches", sz=58),
             E(0.59, "text", x=1400, y=570, s="2 religions", sz=58),
             E(0.72, "text", x=1400, y=660, s="1 cannibal", sz=58, fill="#FFD60A"),
             E(0.88, "text", x=1400, y=780, s="war-proof* (*not really)", sz=46, fill="#FFF3B0")]),
    ("j", "that's the esatian union, i guess.",
     "space", [E(0.0, "rainbow", x=960, y=470, s="that's the esatian union", sz=96),
               E(0.15, "rainbow", x=960, y=610, s="i guess", sz=96)]),
    ("e", "",
     "space", [E(0.0, "text", x=960, y=440, s="the esatian union, i guess", sz=100),
               E(0.3, "fish", x=830, y=680, r=90),
               E(0.5, "text", x=1130, y=680, s="<- still a hostage", sz=44, fill="#FFF3B0"),
               E(0.7, "text", x=960, y=850, s="please subscribe or g minus eats the fish. that threat is ongoing.", sz=38, fill="#DDDDDD")]),
]


def main():
    random.seed(11)
    seg_files, durations = [], []
    for i, (kind, text, bg, els) in enumerate(SEGS):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        if os.path.exists(done):
            dur = len(read_wav(wav)) / SR
            durations.append(dur)
            seg_files.append(os.path.join(OUT, f"seg{i:03d}.mp4"))
            continue
        if kind == "e":
            audio = pad_chord([freq(*n) for n in JCHORD], 4.5, 0.5) * 0.6
            audio = np.concatenate([audio, np.zeros(int(0.5 * SR))])
            write_wav(wav, audio)
        elif kind == "j":
            v = tts(text, voice="af_heart", speed=0.72)
            raw = os.path.join(OUT, f"raw{i:03d}.wav")
            write_wav(raw, v)
            ech = os.path.join(OUT, f"ech{i:03d}.wav")
            subprocess.run(["ffmpeg", "-y", "-i", raw,
                            "-af", "aecho=0.8:0.55:70|150:0.35|0.22,volume=1.1",
                            "-ar", str(SR), "-ac", "1", ech],
                           check=True, capture_output=True)
            v = read_wav(ech)
            dur = len(v) / SR + 0.9
            pad = pad_chord([freq(*n) for n in JCHORD], dur, 0.9)
            mix = np.zeros(int(dur * SR))
            mix[:len(pad)] += pad * 0.45
            ofs = int(0.3 * SR)
            mix[ofs:ofs + len(v)] += v
            write_wav(wav, mix)
        else:
            v = tts(text, voice="am_michael", speed=1.12)
            v = np.concatenate([v, np.zeros(int(0.22 * SR))])
            if i == 0:
                v = np.concatenate([v, np.zeros(int(0.6 * SR))])
            write_wav(wav, v)
        dur = len(read_wav(wav)) / SR
        durations.append(dur)
        cap = text if kind == "n" else ""
        mp4 = render_segment_video(i, bg, els, cap, dur, wav)
        seg_files.append(mp4)
        open(done, "w").close()
        print(f"[{i + 1}/{len(SEGS)}] {kind} {dur:.2f}s", flush=True)

    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{p}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", joined], check=True, capture_output=True)

    total = sum(durations)
    print(f"total duration: {total:.1f}s", flush=True)
    bed_wav = os.path.join(OUT, "bed.wav")
    write_wav(bed_wav, music_bed(total))
    final = os.path.join(OUT, "history_of_the_esatian_union_i_guess_v2.mp4")
    subprocess.run(["ffmpeg", "-y", "-i", joined, "-i", bed_wav,
                    "-filter_complex",
                    "[1:a]volume=0.16[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[a]",
                    "-map", "0:v", "-map", "[a]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final],
                   check=True, capture_output=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
