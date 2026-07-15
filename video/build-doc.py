#!/usr/bin/env python3
"""THE ESATIAN UNION — A History of Government (documentary).

Realistic documentary *treatment* (Ken Burns): painterly Gerig portraits in
aged frames, sepia grade, film grain, vignette, slow pans/zooms, serif lower-
thirds, a solemn Kokoro narrator, and an orchestral score via fluidsynth.
All content drawn from the user's Esatian Union lore document. No photoreal
AI generation — the 'realism' is treatment, not stock photos.
"""
import math
import os
import random
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack

import build_vunderra as vd  # tts / write_wav / read_wav

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "doc_out")
os.makedirs(OUT, exist_ok=True)
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
SR = vd.SR
W, H = 1920, 1080
BW, BH = 2560, 1440   # oversized base for Ken Burns room
FPS_R, FPS_O = 15, 30
SS = 2

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


def F(path, sz):
    return ImageFont.truetype(path, sz)


def hx(h):
    return vd.hx(h)


# ---------------------------------------------------------------- documentary grade
def sepia(img):
    g = img.convert("L")
    arr = np.asarray(g, dtype=np.float32) / 255.0
    # warm brown tone mapping
    r = np.clip(arr * 1.05 + 0.16, 0, 1)
    gg = np.clip(arr * 0.92 + 0.09, 0, 1)
    b = np.clip(arr * 0.72 + 0.03, 0, 1)
    out = np.stack([r, gg, b], axis=-1) * 255
    return Image.fromarray(out.astype(np.uint8), "RGB")


def paper_texture(size, seed=1):
    rng = np.random.RandomState(seed)
    base = rng.normal(0, 1, (size[1] // 4, size[0] // 4)).astype(np.float32)
    tex = Image.fromarray(((base - base.min()) / (np.ptp(base) + 1e-6) * 255).astype(np.uint8))
    tex = tex.resize(size).filter(ImageFilter.GaussianBlur(2))
    return tex


def vignette_mask(size, strength=0.85):
    w, h = size
    y, x = np.ogrid[:h, :w]
    cx, cy = w / 2, h / 2
    d = np.sqrt(((x - cx) / (w * 0.62)) ** 2 + ((y - cy) / (h * 0.62)) ** 2)
    v = np.clip(1 - (d ** 2.2) * strength, 0.15, 1.0)
    return v[..., None]


VIGN = vignette_mask((W, H))
GRAINS = []
for gi in range(6):
    _r = np.random.RandomState(gi).normal(0, 1, (H, W, 1))
    GRAINS.append(_r)


def grade_frame(img, f, dust_seed=0):
    """Apply vignette + film grain + subtle dust to a 1920x1080 RGB frame."""
    a = np.asarray(img, dtype=np.float32)
    a = a * VIGN
    a = a + GRAINS[f % len(GRAINS)] * 7.0            # grain
    a = np.clip(a, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGB")


# ---------------------------------------------------------------- painterly portrait
def painterly(tile):
    """Give a vector bust an aged-painting feel: soften, canvas texture, sepia."""
    t = tile.filter(ImageFilter.GaussianBlur(1.2))
    t = sepia(t)
    tex = paper_texture(t.size, seed=7).convert("RGB")
    t = ImageChops.overlay(t, tex.point(lambda p: 110 + p // 4))
    # brush noise
    a = np.asarray(t, dtype=np.float32)
    a += np.random.RandomState(3).normal(0, 5, a.shape)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


SKINS = {"pale": (232, 205, 178), "med": (214, 176, 140), "tan": (196, 152, 112), "dark": (150, 110, 78)}
HAIRS = {"black": (38, 32, 30), "brown": (78, 54, 34), "gray": (150, 148, 146),
         "auburn": (110, 60, 36), "blonde": (176, 140, 84), "white": (210, 208, 205)}


def draw_bust(P):
    """Return a 900x1100 RGB portrait bust from params P, on dark studio bg."""
    w, h = 900, 1100
    img = Image.new("RGB", (w * SS, h * SS), (46, 40, 34))
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = w / 2, h / 2 - 40
    skin = SKINS[P.get("skin", "med")]
    skin_sh = tuple(int(c * 0.82) for c in skin)
    hair = HAIRS[P.get("hair", "brown")]
    fw = P.get("fw", 150) * SS
    fh = P.get("fh", 190) * SS

    def E(bbox, **kw):
        d.ellipse([v * SS for v in bbox], **kw)
    # shoulders / attire
    att = P.get("attire", (40, 40, 52))
    d.rounded_rectangle([(cx - 270) * SS, (cy + 210) * SS, (cx + 270) * SS, (cy + 470) * SS],
                        radius=70 * SS, fill=att)
    d.polygon([((cx - 70) * SS, (cy + 220) * SS), (cx * SS, (cy + 320) * SS), ((cx + 70) * SS, (cy + 220) * SS)],
              fill=tuple(int(c * 0.8) for c in att))
    if P.get("collar"):
        d.line([(cx - 90) * SS, (cy + 230) * SS, cx * SS, (cy + 300) * SS], fill=P["collar"], width=10 * SS)
        d.line([(cx + 90) * SS, (cy + 230) * SS, cx * SS, (cy + 300) * SS], fill=P["collar"], width=10 * SS)
    # neck
    d.rectangle([(cx - 55) * SS, (cy + 120) * SS, (cx + 55) * SS, (cy + 250) * SS], fill=skin_sh)
    # head
    d.ellipse([(cx * SS - fw), (cy * SS - fh), (cx * SS + fw), (cy * SS + fh)], fill=skin)
    # jaw shadow
    d.chord([(cx * SS - fw * 0.8), (cy * SS - fh * 0.2), (cx * SS + fw * 0.8), (cy * SS + fh)],
            25, 155, fill=skin_sh)
    # ears
    for sgn in (-1, 1):
        E([cx + sgn * 152, cy + 6, cx + sgn * 152, cy + 6], fill=skin)
        d.ellipse([(cx + sgn * 150 - 22) * SS, (cy - 14) * SS, (cx + sgn * 150 + 22) * SS, (cy + 40) * SS], fill=skin)
    # hair
    hs = P.get("hair_style", "short")
    if hs != "bald":
        if hs == "long":
            d.ellipse([(cx - 175) * SS, (cy - 190) * SS, (cx + 175) * SS, (cy + 260) * SS], fill=hair)
            d.ellipse([(cx - 130) * SS, (cy - 40) * SS, (cx + 130) * SS, (cy + 300) * SS], fill=skin)  # face reveal
        # top mass
        d.ellipse([(cx - 158) * SS, (cy - 205) * SS, (cx + 158) * SS, (cy - 20) * SS], fill=hair)
        d.ellipse([(cx - 150) * SS, (cy - 150) * SS, (cx + 150) * SS, (cy + 20) * SS], fill=skin)  # hairline reveal
        if hs == "recede":
            d.ellipse([(cx - 120) * SS, (cy - 120) * SS, (cx + 120) * SS, (cy + 10) * SS], fill=skin)
        # sideburns
        for sgn in (-1, 1):
            d.ellipse([(cx + sgn * 150 - 26) * SS, (cy - 90) * SS, (cx + sgn * 150 + 26) * SS, (cy + 70) * SS], fill=hair)
    # brows
    bcol = hair if P.get("hair") not in ("gray", "white") else (110, 96, 84)
    for sgn in (-1, 1):
        by = cy - 34
        d.line([(cx + sgn * 30) * SS, (by + P.get("brow", 0)) * SS, (cx + sgn * 84) * SS, (by - 6 + P.get("brow", 0)) * SS],
               fill=bcol, width=13 * SS)
    # eyes (solemn, looking to camera)
    for sgn in (-1, 1):
        ex, ey = cx + sgn * 56, cy - 6
        d.ellipse([(ex - 30) * SS, (ey - 16) * SS, (ex + 30) * SS, (ey + 16) * SS], fill=(245, 240, 232))
        ir = P.get("eyes", (70, 90, 110))
        d.ellipse([(ex - 12) * SS, (ey - 12) * SS, (ex + 12) * SS, (ey + 12) * SS], fill=ir)
        d.ellipse([(ex - 6) * SS, (ey - 6) * SS, (ex + 6) * SS, (ey + 6) * SS], fill=(20, 16, 14))
        d.arc([(ex - 30) * SS, (ey - 18) * SS, (ex + 30) * SS, (ey + 14) * SS], 185, 355, fill=skin_sh, width=5 * SS)
    # nose
    d.line([(cx - 4) * SS, (cy - 20) * SS, (cx - 12) * SS, (cy + 40) * SS], fill=skin_sh, width=7 * SS)
    d.arc([(cx - 22) * SS, (cy + 22) * SS, (cx + 10) * SS, (cy + 56) * SS], 20, 160, fill=skin_sh, width=6 * SS)
    # mouth (neutral, solemn)
    mo = P.get("mouth", "neutral")
    if mo == "slight":
        d.arc([(cx - 40) * SS, (cy + 60) * SS, (cx + 40) * SS, (cy + 104) * SS], 15, 165, fill=(120, 70, 66), width=7 * SS)
    else:
        d.line([(cx - 38) * SS, (cy + 86) * SS, (cx + 38) * SS, (cy + 86) * SS], fill=(120, 74, 70), width=7 * SS)
    # facial hair
    fhair = P.get("facial")
    if fhair in ("beard", "full"):
        d.ellipse([(cx - 110) * SS, (cy + 40) * SS, (cx + 110) * SS, (cy + 210) * SS], fill=hair)
        d.ellipse([(cx - 90) * SS, (cy + 20) * SS, (cx + 90) * SS, (cy + 96) * SS], fill=skin)  # reveal mouth area
    if fhair in ("mustache", "full", "beard"):
        d.line([(cx - 44) * SS, (cy + 66) * SS, (cx + 44) * SS, (cy + 66) * SS], fill=hair, width=14 * SS)
    if P.get("crown"):
        cw = 150
        pts = [(cx - cw / 2, cy - fh / SS + 6), (cx - cw / 2, cy - fh / SS - 30),
               (cx - cw / 4, cy - fh / SS - 6), (cx, cy - fh / SS - 46),
               (cx + cw / 4, cy - fh / SS - 6), (cx + cw / 2, cy - fh / SS - 30),
               (cx + cw / 2, cy - fh / SS + 6)]
        d.polygon([(p[0] * SS, p[1] * SS) for p in pts], fill=(198, 164, 96), outline=(120, 96, 40), width=3 * SS)
    return img.resize((w, h), Image.LANCZOS)


def framed_portrait(P, seed=1):
    """Painterly bust inside an ornate oval frame on aged canvas -> BW x BH base."""
    base = aged_base(seed)
    d = ImageDraw.Draw(base, "RGBA")
    bust = painterly(draw_bust(P))
    # oval vignette mask on the bust
    bw2, bh2 = bust.size
    m = Image.new("L", bust.size, 0)
    ImageDraw.Draw(m).ellipse([bw2 * 0.06, bh2 * 0.02, bw2 * 0.94, bh2 * 0.98], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(40))
    px, py = BW // 2 - bw2 // 2, BH // 2 - bh2 // 2 - 40
    base.paste(bust, (px, py), m)
    # ornate frame (oval, gold, aged)
    cx, cy = BW // 2, BH // 2 - 40
    rx, ry = bw2 * 0.46, bh2 * 0.5
    for i, (col, wdt) in enumerate([((150, 120, 60), 26), ((198, 164, 96), 14), ((120, 96, 46), 6)]):
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=col, width=wdt)
    return base


# ---------------------------------------------------------------- aged backgrounds / maps / documents
def aged_base(seed=1):
    top = np.array([74, 62, 46], float); bot = np.array([44, 36, 27], float)
    col = np.linspace(top, bot, BH).astype(np.uint8)
    img = Image.fromarray(np.repeat(col[:, None, :], BW, axis=1), "RGB")
    tex = paper_texture((BW, BH), seed).convert("RGB")
    img = ImageChops.overlay(img, tex.point(lambda p: 96 + p // 5))
    return img


def map_base(seed=2, highlight=True):
    base = aged_base(seed)
    d = ImageDraw.Draw(base, "RGBA")
    rng = random.Random(seed)
    # a landmass blob (the Esatian region) drawn as an old cartographic shape
    cx, cy = BW // 2, BH // 2
    pts = []
    for i in range(40):
        a = 2 * math.pi * i / 40
        r = 420 + 120 * math.sin(a * 3 + seed) + rng.uniform(-40, 40)
        pts.append((cx + r * math.cos(a) * 1.15, cy + r * math.sin(a) * 0.8))
    d.polygon(pts, fill=(96, 84, 60), outline=(60, 50, 36), width=5)
    if highlight:
        # union territory highlight
        for k in range(5):
            bx = cx + rng.uniform(-260, 260); by = cy + rng.uniform(-180, 180)
            d.ellipse([bx - 90, by - 70, bx + 90, by + 70], outline=(150, 120, 70), width=3)
    # compass rose
    ox, oy = BW - 300, BH - 300
    for a in range(0, 360, 45):
        r1, r2 = (70, 24) if a % 90 == 0 else (44, 20)
        d.line([ox, oy, ox + r1 * math.cos(math.radians(a)), oy + r1 * math.sin(math.radians(a))],
               fill=(150, 128, 80), width=3)
    d.ellipse([ox - 8, oy - 8, ox + 8, oy + 8], fill=(150, 128, 80))
    # faint grid / lat-long
    for gx in range(0, BW, 260):
        d.line([gx, 0, gx, BH], fill=(120, 100, 70, 40), width=1)
    for gy in range(0, BH, 260):
        d.line([0, gy, BW, gy], fill=(120, 100, 70, 40), width=1)
    return base


def document_base(seed=3, lines=6, seal=True):
    base = aged_base(seed)
    d = ImageDraw.Draw(base, "RGBA")
    # a page of an old constitution
    px0, py0, px1, py1 = BW // 2 - 620, 180, BW // 2 + 620, BH - 180
    d.rectangle([px0, py0, px1, py1], fill=(206, 186, 150))
    d.rectangle([px0, py0, px1, py1], outline=(120, 100, 70), width=6)
    fnt = F(SERIF_B, 60)
    d.text((BW // 2, py0 + 90), "CONSTITUTION", font=fnt, fill=(70, 54, 34), anchor="mm")
    d.line([px0 + 120, py0 + 160, px1 - 120, py0 + 160], fill=(120, 100, 70), width=3)
    fl = F(SERIF, 34)
    for i in range(lines):
        yy = py0 + 240 + i * 70
        ln_w = (px1 - px0) - 240 - (200 if i == lines - 1 else 0)
        d.line([px0 + 120, yy, px0 + 120 + ln_w, yy], fill=(110, 92, 66), width=6)
    if seal:
        sx, sy = BW // 2, py1 - 150
        d.ellipse([sx - 90, sy - 90, sx + 90, sy + 90], outline=(150, 40, 34), width=8)
        import math as _m
        pts = []
        for i in range(10):
            ang = -_m.pi / 2 + i * _m.pi / 5
            rad = 52 if i % 2 == 0 else 22
            pts.append((sx + rad * _m.cos(ang), sy + rad * _m.sin(ang)))
        d.polygon(pts, fill=(150, 40, 34))
    return base


def title_base():
    base = map_base(seed=9)
    dark = Image.new("RGBA", (BW, BH), (20, 16, 12, 150))
    base = Image.alpha_composite(base.convert("RGBA"), dark).convert("RGB")
    return base


# ---------------------------------------------------------------- Ken Burns + render
def ease(p):
    return p * p * (3 - 2 * p)  # smoothstep


def render_scene(idx, base, kb, lower, dur, wav):
    """kb = (sx0,sy0,sw0, sx1,sy1,sw1) crop rects (in base coords) start->end."""
    nf = max(int(dur * FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS_R), "-i", "-",
         "-i", wav, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
         "-r", str(FPS_O), "-c:a", "aac", "-b:a", "160k", "-t", f"{dur:.3f}", mp4],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sx0, sy0, sw0, sx1, sy1, sw1 = kb
    ar = H / W
    lt_font = F(SERIF_B, 54); lt_sub = F(SERIF, 34)
    for f in range(nf):
        p = ease(f / max(1, nf - 1))
        sx = sx0 + (sx1 - sx0) * p; sy = sy0 + (sy1 - sy0) * p; sw = sw0 + (sw1 - sw0) * p
        sh = sw * ar
        crop = base.crop((int(sx), int(sy), int(sx + sw), int(sy + sh))).resize((W, H), Image.LANCZOS)
        frame = grade_frame(crop, f)
        d = ImageDraw.Draw(frame, "RGBA")
        if lower:
            name, sub = lower
            # lower-third bar
            d.rectangle([0, H - 200, W, H - 60], fill=(16, 12, 9, 150))
            d.line([90, H - 196, 90, H - 66], fill=(198, 164, 96), width=5)
            d.text((120, H - 168), name, font=lt_font, fill=(238, 228, 210), anchor="lm")
            d.text((122, H - 108), sub, font=lt_sub, fill=(198, 176, 140), anchor="lm")
        proc.stdin.write(frame.convert("RGB").tobytes())
    proc.stdin.close(); proc.wait()
    return mp4


# Ken Burns helpers (base is BW x BH)
def kb_in(cx=BW / 2, cy=BH / 2, w0=BW, w1=BW * 0.72):
    return (cx - w0 / 2, cy - w0 * H / W / 2, w0, cx - w1 / 2, cy - w1 * H / W / 2, w1)


def kb_pan(w=BW * 0.82, dx=180, dy=-60):
    sh = w * H / W
    x0 = (BW - w) / 2 - dx / 2; y0 = (BH - sh) / 2 - dy / 2
    return (x0, y0, w, x0 + dx, y0 + dy, w)


def kb_portrait_pushin():
    # start on face, gentle push in
    cx, cy = BW / 2, BH / 2 - 120
    return (cx - BW * 0.5, cy - BW * 0.5 * H / W, BW * 1.0, cx - BW * 0.40, cy - BW * 0.40 * H / W, BW * 0.80)


# ---------------------------------------------------------------- orchestral score
def n(name, o):
    NN = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
          "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    return NN[name] + 12 * (o + 1)


SCORE_CH = {  # chord tones (mid) for strings
    "Dm": [n("D", 3), n("F", 3), n("A", 3), n("D", 4)],
    "Bb": [n("A#", 2), n("D", 3), n("F", 3), n("A#", 3)],
    "F":  [n("F", 2), n("A", 3), n("C", 4), n("F", 4)],
    "C":  [n("C", 3), n("E", 3), n("G", 3), n("C", 4)],
    "Gm": [n("G", 2), n("A#", 3), n("D", 4), n("G", 4)],
    "A":  [n("A", 2), n("C#", 4), n("E", 4), n("A", 4)],
}
PROG = ["Dm", "Bb", "F", "C", "Dm", "Gm", "A", "A"]
MELODY = [("A", 4), ("D", 5), ("C", 5), ("A", 4), ("Bb", 4), ("F", 4), ("G", 4), ("A", 4)]


def compose_score(total_dur):
    TPB = 480
    bpm = 62
    mid = MidiFile(ticks_per_beat=TPB)
    meta = MidiTrack(); mid.tracks.append(meta)
    meta.append(MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    beats = total_dur * bpm / 60.0
    bar = 4  # 4 beats per chord
    tracks = {"str1": (0, 48), "str2": (1, 49), "cello": (2, 42),
              "horn": (3, 60), "timp": (4, 47), "choir": (5, 52)}
    ev = {k: [] for k in tracks}

    def add(k, beat, dur, pitch, vel):
        a = int(beat * TPB); b = int((beat + dur) * TPB) - 4
        ev[k].append((a, 1, pitch, vel)); ev[k].append((max(a + 1, b), 0, pitch, 0))
    b = 0.0; i = 0
    while b < beats:
        ch = PROG[i % len(PROG)]
        tones = SCORE_CH[ch]
        swell = 46 + int(18 * math.sin(i * 0.6))
        for p in tones:
            add("str1", b, bar, p + 12, swell)
            add("str2", b, bar, p, swell - 8)
        add("cello", b, bar, tones[0] - 12, 60)
        # horn melody every other bar
        if i % 2 == 0:
            mn = MELODY[(i // 2) % len(MELODY)]
            add("horn", b + 0.5, bar - 1, n(*mn), 66)
            add("choir", b + 0.5, bar - 1, n(*mn) + 12, 30)
        # timpani accents at phrase starts
        if i % 4 == 0:
            add("timp", b, 1, n("D", 2), 78)
            add("timp", b + 0.5, 0.5, n("A", 1), 60)
        b += bar; i += 1

    for k, (chn, prog) in tracks.items():
        tr = MidiTrack(); mid.tracks.append(tr)
        tr.append(Message("program_change", channel=chn, program=prog, time=0))
        tr.append(Message("control_change", channel=chn, control=91, value=90, time=0))
        evs = sorted(ev[k], key=lambda e: (e[0], e[1])); last = 0
        for (tick, kind, pitch, vel) in evs:
            dt = tick - last; last = tick
            tr.append(Message("note_on" if kind else "note_off", channel=chn, note=pitch,
                             velocity=vel if kind else 0, time=dt))
    midp = os.path.join(OUT, "score.mid"); mid.save(midp)
    wav = os.path.join(OUT, "score.wav")
    subprocess.run(["fluidsynth", "-ni", "-g", "0.7", "-F", wav, "-r", str(SR), "-R", "1", SF2, midp],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return wav
