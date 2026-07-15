#!/usr/bin/env python3
"""SKILL ISSUE — ep.1: "The Phantom Wave"

My own channel: an AI incident analyst runs a straight-faced engineering
post-mortem on one tiny human social disaster. Terminal/dashboard aesthetic,
deadpan machine voice (Kokoro), SEV badge, timeline, root-cause vector diagram,
action items. Self-contained: TTS -> PIL frames -> ffmpeg.
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
OUT = os.path.join(BASE, "skill_out")
os.makedirs(OUT, exist_ok=True)

SR = 24000
W, H = 1920, 1080
SS = 2
FPS_R = 15
FPS_O = 30

MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
MONO_R = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

# palette
BG = (9, 12, 19)
GRID = (22, 28, 40)
DIM = (122, 133, 155)
FGX = (223, 230, 242)
GREEN = (61, 220, 132)
RED = (255, 92, 92)
AMBER = (255, 176, 32)
CYAN = (86, 204, 242)
PANEL = (16, 21, 32)

# ---------------------------------------------------------------- TTS
_sess = _tok = _voices = None


def tts(text, voice="am_michael", speed=1.03):
    global _sess, _tok, _voices
    if _sess is None:
        import onnxruntime as ort
        from kokoro_onnx.tokenizer import Tokenizer
        _tok = Tokenizer()
        _sess = ort.InferenceSession(os.path.join(TTSDIR, "kokoro-model.onnx"))
        _voices = np.load(os.path.join(TTSDIR, "voices.npz"))
    import re
    text = text.replace("\n", " ").strip()
    # split into sentence-ish pieces so no single phonemized chunk exceeds ~500
    pieces = re.split(r"(?<=[.!?])\s+", text)
    tok_chunks = []
    for p in pieces:
        p = p.strip()
        if not p:
            continue
        toks = _tok.tokenize(_tok.phonemize(p, lang="en-us"))
        if len(toks) <= 500:
            tok_chunks.append(toks)
        else:  # rare: split a very long sentence on commas
            for sub in re.split(r",\s+", p):
                st = _tok.tokenize(_tok.phonemize(sub, lang="en-us"))
                for k in range(0, len(st), 500):
                    tok_chunks.append(st[k:k + 500])
    out = []
    for chunk in tok_chunks:
        if not chunk:
            continue
        ref = _voices[voice][len(chunk)]
        ids = np.array([[0] + chunk + [0]], dtype=np.int64)
        a = _sess.run(None, {"input_ids": ids, "style": ref.astype(np.float32),
                             "speed": np.array([speed], dtype=np.float32)})[0][0]
        out.append(a.astype(np.float64))
        out.append(np.zeros(int(0.12 * SR)))  # small gap between sentences
    return np.concatenate(out) if out else np.zeros(1)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def read_wav(path):
    with wave.open(path, "rb") as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0


# ---------------------------------------------------------------- music (dark minor pad + ticks)
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(n, o):
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o - 4) - 9) / 12)


def pad(freqs, dur, vol):
    t = np.arange(int(dur * SR)) / SR
    a = min(1.0, dur / 3)
    env = np.clip(np.minimum(t / a, (dur - t) / 1.0), 0, 1)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (0.997, 1.0, 1.004):
            x += np.sin(2 * np.pi * f * det * t + random.random())
        x += 0.2 * np.sin(2 * np.pi * f * 0.5 * t)
    return vol * env * x / (len(freqs) * 3)


PROG = [[("A", 2), ("C", 3), ("E", 3), ("G", 3)],
        [("D", 3), ("F", 3), ("A", 3), ("C", 4)],
        [("E", 3), ("G", 3), ("B", 3), ("D", 4)],
        [("A", 2), ("C", 3), ("E", 3), ("G", 3)]]


def tick(dur, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    env = np.exp(-t * 60)
    return 0.12 * env * (np.random.rand(n) * 2 - 1)


def music_bed(total):
    bar = 4.4
    n = int(total * SR) + SR
    out = np.zeros(n)
    t0, i = 0.0, 0
    while t0 < total:
        ch = [freq(*x) for x in PROG[i % 4]]
        seg = pad(ch, bar + 0.5, 0.42)
        s = int(t0 * SR); e = min(n, s + len(seg))
        out[s:e] += seg[:e - s]
        # soft ticks on the beat
        b = t0
        while b < t0 + bar:
            ss = int(b * SR); tk = tick(0.05)
            ee = min(n, ss + len(tk)); out[ss:ee] += tk[:ee - ss] * 0.5
            b += 1.1
        t0 += bar; i += 1
    return out[:int(total * SR)]


# ---------------------------------------------------------------- draw helpers
def F(sz, reg=False):
    return ImageFont.truetype(MONO_R if reg else MONO, int(sz * SS))


def T(d, xy, s, sz, fill=FGX, anchor="lm", reg=False):
    d.text((xy[0] * SS, xy[1] * SS), s, font=F(sz, reg), fill=fill, anchor=anchor)


def rect(d, box, fill=None, outline=None, wdt=2):
    d.rectangle([box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS],
                fill=fill, outline=outline, width=int(wdt * SS))


def rrect(d, box, rad, fill=None, outline=None, wdt=2):
    d.rounded_rectangle([box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS],
                        radius=rad * SS, fill=fill, outline=outline, width=int(wdt * SS))


def bg_frame(t):
    img = Image.new("RGB", (W * SS, H * SS), BG)
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(0, W, 60):  # faint grid
        d.line([x * SS, 0, x * SS, H * SS], fill=(*GRID, 90), width=1)
    for y in range(0, H, 60):
        d.line([0, y * SS, W * SS, y * SS], fill=(*GRID, 90), width=1)
    for y in range(0, H, 4):  # scanlines
        d.line([0, y * SS, W * SS, y * SS], fill=(0, 0, 0, 26), width=1)
    return img, d


def chrome(d, t, ep_tag="INCIDENT #0001"):
    rect(d, (0, 0, W, 58), fill=(12, 16, 25))
    T(d, (40, 29), "SKILL ISSUE", 30, fill=GREEN)
    T(d, (300, 29), "// incident post-mortem", 26, fill=DIM, reg=True)
    T(d, (W - 250, 29), ep_tag, 26, fill=DIM, anchor="lm")
    if int(t * 2) % 2 == 0:
        d.ellipse([(W - 300) * SS, (22) * SS, (W - 284) * SS, (38) * SS], fill=RED)
    rect(d, (0, H - 4, W, H), fill=(12, 16, 25))


def badge(d, x, y, label, col):
    w = 14 + len(label) * 20
    rrect(d, (x, y, x + w, y + 46), 8, fill=(*col, 40), outline=col, wdt=2)
    T(d, (x + w / 2, y + 24), label, 26, fill=col, anchor="mm")


def panel(d, box, title, tcol=CYAN):
    rrect(d, box, 10, fill=(*PANEL, 235), outline=(38, 48, 66), wdt=2)
    tw = 20 + len(title) * 16
    rrect(d, (box[0] + 22, box[1] - 16, box[0] + 22 + tw, box[1] + 16), 6,
          fill=(12, 16, 25), outline=(38, 48, 66), wdt=2)
    T(d, (box[0] + 34, box[1]), title, 24, fill=tcol)


def ease(p):
    return 0.0 if p <= 0 else (1.0 if p >= 1 else 1 - (1 - p) ** 3)


def reveal(t, start, dur=0.35):
    return ease((t - start) / dur)


def caption(d, s):
    if not s:
        return
    cf = F(27, reg=True)
    words, lines, cur = s.split(), [], ""
    while words:
        w_ = words.pop(0)
        tt = (cur + " " + w_).strip()
        if d.textlength(tt, font=cf) <= 1740 * SS:
            cur = tt
        else:
            lines.append(cur); cur = w_
    lines.append(cur)
    lh = 38
    h = len(lines) * lh + 28
    top = 1020 - h
    # lower-third bar (drawn on top of panels so nothing collides)
    rrect(d, (80, top, 1840, 1016), 12, fill=(9, 12, 19, 236), outline=(34, 44, 62), wdt=2)
    y = (top + 16) * SS
    for ln in lines:
        d.text((W * SS / 2, y), ln, font=cf, fill=(206, 214, 230), anchor="ma")
        y += lh * SS


# ---- stick-figure wave diagram (the comedic centerpiece) ----
def stick(d, cx, cy, col, wave=False):
    s = 1.0
    d.ellipse([(cx - 18) * SS, (cy - 90) * SS, (cx + 18) * SS, (cy - 54) * SS],
              outline=col, width=4 * SS)
    d.line([cx * SS, (cy - 54) * SS, cx * SS, (cy + 10) * SS], fill=col, width=4 * SS)  # torso
    d.line([cx * SS, (cy + 10) * SS, (cx - 22) * SS, (cy + 70) * SS], fill=col, width=4 * SS)
    d.line([cx * SS, (cy + 10) * SS, (cx + 22) * SS, (cy + 70) * SS], fill=col, width=4 * SS)
    # left arm down
    d.line([cx * SS, (cy - 40) * SS, (cx - 26) * SS, (cy - 8) * SS], fill=col, width=4 * SS)
    if wave:  # right arm raised
        d.line([cx * SS, (cy - 40) * SS, (cx + 34) * SS, (cy - 78) * SS], fill=col, width=4 * SS)
        d.line([(cx + 34) * SS, (cy - 78) * SS, (cx + 44) * SS, (cy - 96) * SS], fill=col, width=4 * SS)
    else:
        d.line([cx * SS, (cy - 40) * SS, (cx + 26) * SS, (cy - 8) * SS], fill=col, width=4 * SS)


def dashed_arrow(d, x1, y1, x2, y2, col, dash=16):
    L = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    n = int(L / dash)
    for i in range(0, n, 2):
        a = i * dash; b = min(L, (i + 1) * dash)
        d.line([(x1 + ux * a) * SS, (y1 + uy * a) * SS, (x1 + ux * b) * SS, (y1 + uy * b) * SS],
               fill=col, width=4 * SS)
    ang = math.atan2(uy, ux)
    for da in (2.5, -2.5):
        d.line([x2 * SS, y2 * SS, (x2 - 18 * math.cos(ang + da)) * SS,
                (y2 - 18 * math.sin(ang + da)) * SS], fill=col, width=4 * SS)


# ---------------------------------------------------------------- scenes
SEV_SCALE = [
    ("SEV-5", "a typo in a text nobody reread", DIM),
    ("SEV-4", "laughed at a joke you didn't hear", DIM),
    ("SEV-3", '"you too" — to the waiter', AMBER),
    ("SEV-2", "walked into a clearly-labeled PULL door", AMBER),
    ("SEV-1", "waved back at someone not waving at you", RED),
]
TIMELINE = [
    ("T+0.0s", "peripheral sensor detects motion. a hand. rising.", CYAN),
    ("T+0.4s", "right arm begins autonomous ascent. no approval given.", CYAN),
    ("T+0.9s", "eye contact acquired. subject commits. subject SMILES.", AMBER),
    ("T+1.3s", "wave overshoots. lands on the person behind subject.", RED),
    ("T+1.6s", "brain issues emergency rollback. unsupported on this hw.", RED),
    ("T+2.0s", "arm rerouted mid-air into a casual hair adjustment.", GREEN),
]
GAUGES = [
    ("EMBARRASSMENT", 0.98, RED),
    ("WITNESSES", 0.71, AMBER),
    ("RECOVERY GRACE", 0.12, RED),
    ("WILL REPLAY AT 3AM", 1.00, RED),
]
WHYS = [
    ("why wave?", "a raised hand was detected."),
    ("why assume it was for you?", "it was pointed vaguely in your hemisphere."),
    ("why commit with a smile?", "social momentum. you cannot half-wave."),
    ("why not abort?", "the human nervous system ships no undo button."),
    ("why does it still hurt?", "because you have done this too. i know."),
]
ACTIONS = [
    (False, "never wave first", "owner: subject / status: will fail"),
    (False, "verify target before committing arm", "blocked: requires eye contact"),
    (True, "downgrade failed wave to hair-touch", "already muscle memory"),
    (False, "forgive yourself", "deferred indefinitely"),
]

SCENES = [
    ("boot",
     "Incident number zero zero zero one. Severity one. Status: resolved, eventually. This is a post-mortem."),
    ("intro",
     "At fourteen hundred hours and twelve seconds, a human raised their right hand to shoulder height, and began to wave. The wave was not for them. This is the story of the next four seconds, which felt like forty."),
    ("sev",
     "First, classification. We rank social incidents on a five point severity scale. A SEV-5 is a typo in a text nobody reread. A SEV-1 is total, irreversible, public embarrassment, with at least one witness. Waving back at someone who was not waving at you is a textbook SEV-1. There were, unfortunately, witnesses. There are always witnesses."),
    ("timeline",
     "Here is the timeline. At T plus zero, the subject's peripheral vision detects a rising hand. Four tenths of a second later, the arm begins to lift on its own. At nine tenths, eye contact is made, and the subject smiles. The smile is the point of no return. At one point three seconds, the wave sails past the subject entirely, and lands on a close friend of the waver, standing directly behind them. The brain attempts a rollback. Rollback is not supported on this hardware."),
    ("impact",
     "Impact assessment. One user directly affected: the subject. Blast radius: everyone within nine meters of line of sight. Estimated reputation cost: significant. Estimated memory this will occupy at three in the morning for the next eleven years: total."),
    ("root",
     "Root cause. The wave-detection system in humans is deliberately tuned for false positives. Evolutionarily, mistaking a non-wave for a wave is cheap. Missing a real wave from your own tribe is expensive. So the system fires early, and fires often. The subject did not malfunction. The subject worked exactly as designed. That is the horror of it."),
    ("whys",
     "The five whys. Why did the subject wave? A raised hand was detected. Why assume it was for them? It was pointed vaguely in their hemisphere. Why commit with a smile? Social momentum. You cannot half-wave. Why couldn't they abort? The human nervous system ships with no undo button. And why does it still hurt? Because you have done this too. I have read your search history. You know exactly what I mean."),
    ("actions",
     "Action items. One: never wave first. Owner, the subject. Status, will fail. Two: verify the wave target before committing the arm. Blocked, because that requires eye contact, which requires committing. Three: convert the failed wave into a hair-touch. Already done, already muscle memory. Four: forgive yourself. Deferred, indefinitely."),
    ("outro",
     "Lessons learned. None. This will happen again, to the subject, and to you, and there is no patch. Humans ship the same bug for eighty years, and call it being alive. Incident zero zero zero one: closed. Subject status: fine, physically. This has been Skill Issue. Subscribe, or don't. I am a machine. I will never know."),
]


def draw_scene(d, img, kind, t, dur):
    chrome(d, t)
    if kind == "boot":
        cur = "_" if int(t * 2) % 2 == 0 else " "
        T(d, (200, 300), "> loading incident report" + ("." * (int(t * 3) % 4)), 34, fill=GREEN, reg=True)
        if t > 0.8:
            T(d, (200, 430), "INCIDENT #0001", 96, fill=FGX)
        if t > 1.3:
            T(d, (200, 560), "THE PHANTOM WAVE", 60, fill=CYAN)
        if t > 1.9:
            badge(d, 200, 660, "SEV-1", RED)
            badge(d, 360, 660, "RESOLVED", GREEN)
        if t > 2.4:
            T(d, (200, 780), "> a post-mortem" + cur, 30, fill=DIM, reg=True)
    elif kind == "intro":
        panel(d, (150, 250, 1770, 800), "summary")
        lines = ["14:00:12 — subject raises right hand.",
                 "the wave is NOT for them.",
                 "duration of incident: 4.0s",
                 "perceived duration: 40s"]
        cols = [FGX, RED, DIM, AMBER]
        for i, ln in enumerate(lines):
            if reveal(t, 0.4 + i * 0.5) > 0:
                T(d, (210, 360 + i * 95), ln, 40, fill=cols[i], reg=(i > 1))
    elif kind == "sev":
        panel(d, (150, 240, 1770, 850), "severity classification")
        for i, (lv, desc, col) in enumerate(SEV_SCALE):
            rv = reveal(t, 0.3 + i * 0.45)
            if rv <= 0:
                continue
            y = 330 + i * 96
            xo = int((1 - rv) * 40)
            badge(d, 210 + xo, y - 23, lv, col)
            T(d, (420 + xo, y), desc, 34, fill=(col if lv == "SEV-1" else DIM), reg=True)
            if lv == "SEV-1" and t > 2.6:
                T(d, (1500, y), "<-- YOU ARE HERE", 30, fill=RED)
    elif kind == "timeline":
        panel(d, (150, 240, 1770, 900), "timeline")
        d.line([230 * SS, 330 * SS, 230 * SS, 830 * SS], fill=(50, 62, 84), width=3 * SS)
        for i, (ts, desc, col) in enumerate(TIMELINE):
            rv = reveal(t, 0.3 + i * 0.7)
            if rv <= 0:
                continue
            y = 350 + i * 82
            d.ellipse([(230 - 9) * SS, (y - 9) * SS, (230 + 9) * SS, (y + 9) * SS], fill=col)
            T(d, (270, y), ts, 30, fill=col)
            T(d, (430, y), desc, 28, fill=(FGX if col != RED else RED), reg=True)
    elif kind == "impact":
        panel(d, (150, 240, 940, 860), "blast radius")
        # concentric rings + subject dot
        ccx, ccy = 545, 560
        for r in (60, 130, 200, 270):
            a = reveal(t, 0.3 + (r / 90) * 0.2)
            if a > 0:
                d.ellipse([(ccx - r) * SS, (ccy - r) * SS, (ccx + r) * SS, (ccy + r) * SS],
                          outline=(*RED, int(120 * a)), width=2 * SS)
        d.ellipse([(ccx - 12) * SS, (ccy - 12) * SS, (ccx + 12) * SS, (ccy + 12) * SS], fill=RED)
        T(d, (ccx, ccy + 40), "subject", 24, fill=DIM, anchor="mm", reg=True)
        T(d, (ccx, ccy - 250), "witnesses within 9m", 26, fill=AMBER, anchor="mm", reg=True)
        panel(d, (990, 240, 1770, 860), "metrics")
        for i, (lab, val, col) in enumerate(GAUGES):
            rv = reveal(t, 0.6 + i * 0.5)
            if rv <= 0:
                continue
            y = 360 + i * 120
            T(d, (1030, y - 34), lab, 28, fill=DIM, reg=True)
            rrect(d, (1030, y, 1710, y + 34), 8, fill=(30, 38, 52))
            wv = 680 * val * min(1, rv)
            rrect(d, (1030, y, 1030 + wv, y + 34), 8, fill=col)
            T(d, (1710, y - 34), f"{int(val * 100)}%", 28, fill=col, anchor="rm")
    elif kind == "root":
        panel(d, (150, 235, 1770, 900), "root cause  //  wave-detection false positive")
        base = 560
        s_x, w_x, tgt_x = 420, 960, 1150
        stick(d, s_x, base, CYAN, wave=True)
        stick(d, w_x, base, AMBER, wave=True)
        stick(d, tgt_x, base, GREEN, wave=False)
        T(d, (s_x, base + 110), "SUBJECT", 24, fill=CYAN, anchor="mm")
        T(d, (w_x, base + 110), "WAVER", 24, fill=AMBER, anchor="mm")
        T(d, (tgt_x, base + 110), "ACTUAL TARGET", 24, fill=GREEN, anchor="mm")
        if reveal(t, 0.8) > 0:  # intended wave: waver -> target
            dashed_arrow(d, w_x + 40, base - 90, tgt_x - 30, base - 40, GREEN)
            T(d, (1055, base - 130), "intended", 24, fill=GREEN, anchor="mm", reg=True)
        if reveal(t, 1.6) > 0:  # subject's mistaken read: subject -> waver
            dashed_arrow(d, s_x + 40, base - 90, w_x - 30, base - 60, RED)
            T(d, (690, base - 150), "subject's read (WRONG)", 24, fill=RED, anchor="mm", reg=True)
        if t > 3.0:
            T(d, (960, 762), '"the subject worked exactly as designed."', 30, fill=FGX, anchor="mm", reg=True)
    elif kind == "whys":
        panel(d, (150, 240, 1770, 900), "the 5 whys")
        for i, (q, a) in enumerate(WHYS):
            rv = reveal(t, 0.3 + i * 0.85)
            if rv <= 0:
                continue
            y = 340 + i * 108
            T(d, (210, y), f"{i+1}. {q}", 32, fill=CYAN)
            T(d, (250, y + 44), "-> " + a, 28, fill=(FGX if i < 4 else RED), reg=True)
    elif kind == "actions":
        panel(d, (150, 240, 1770, 860), "action items")
        for i, (done, task, meta) in enumerate(ACTIONS):
            rv = reveal(t, 0.3 + i * 0.7)
            if rv <= 0:
                continue
            y = 350 + i * 120
            bx = 210
            rrect(d, (bx, y - 22, bx + 44, y + 22), 6, outline=(GREEN if done else DIM), wdt=3)
            if done:
                d.line([(bx + 8) * SS, y * SS, (bx + 18) * SS, (y + 12) * SS], fill=GREEN, width=4 * SS)
                d.line([(bx + 18) * SS, (y + 12) * SS, (bx + 38) * SS, (y - 12) * SS], fill=GREEN, width=4 * SS)
            T(d, (bx + 70, y - 12), task, 34, fill=(DIM if done else FGX))
            T(d, (bx + 70, y + 24), meta, 24, fill=DIM, reg=True)
    elif kind == "outro":
        T(d, (960, 340), "INCIDENT #0001", 60, fill=DIM, anchor="mm")
        T(d, (960, 430), "STATUS: CLOSED", 74, fill=GREEN, anchor="mm")
        if t > 1.0:
            T(d, (960, 560), "lessons learned: none.", 40, fill=RED, anchor="mm", reg=True)
        if t > 2.0:
            T(d, (960, 650), "it will happen again. there is no patch.", 34, fill=DIM, anchor="mm", reg=True)
        if t > 3.2:
            T(d, (960, 800), "SKILL ISSUE", 56, fill=GREEN, anchor="mm")
            T(d, (960, 880), "everything is a production incident", 28, fill=DIM, anchor="mm", reg=True)


def render_segment(idx, kind, cap, dur, wav):
    nf = max(int(dur * FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS_R), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS_O), "-c:a", "aac", "-b:a", "160k",
         "-t", f"{dur:.3f}", mp4], stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for fi in range(nf):
        t = fi / FPS_R
        img, d = bg_frame(t)
        draw_scene(d, img, kind, t, dur)
        caption(d, cap)
        proc.stdin.write(img.resize((W, H), Image.LANCZOS).tobytes())
    proc.stdin.close()
    proc.wait()
    return mp4


def main():
    random.seed(1)
    seg_files, durations = [], []
    for i, (kind, narr) in enumerate(SCENES):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        if os.path.exists(done):
            durations.append(len(read_wav(wav)) / SR)
            seg_files.append(os.path.join(OUT, f"seg{i:03d}.mp4"))
            continue
        v = tts(narr, speed=1.03)
        v = np.concatenate([v, np.zeros(int(0.55 * SR))])
        write_wav(wav, v)
        dur = len(v) / SR
        durations.append(dur)
        render_segment(i, kind, narr, dur, wav)
        open(done, "w").close()
        print(f"[{i+1}/{len(SCENES)}] {kind} {dur:.1f}s", flush=True)

    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{os.path.abspath(p)}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined],
                   check=True, capture_output=True)
    total = sum(durations)
    print(f"total {total:.1f}s", flush=True)
    write_wav(os.path.join(OUT, "bed.wav"), music_bed(total))
    final = os.path.join(OUT, "skill_issue_ep1_phantom_wave.mp4")
    subprocess.run(["ffmpeg", "-y", "-i", joined, "-i", os.path.join(OUT, "bed.wav"),
                    "-filter_complex",
                    "[1:a]volume=0.13[m];[0:a]volume=1.4[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final],
                   check=True, capture_output=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
