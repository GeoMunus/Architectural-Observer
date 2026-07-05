#!/usr/bin/env python3
"""Every Neurotransmitter Explained — "Explained in N Minutes" style.

Dark theme, calm narration (Kokoro), one molecule diagram per neurotransmitter,
type tag + fact bullets that pop in, progress counter. No jingles.
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
OUT = os.path.join(BASE, "neuro_out")
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


def tts(text, voice="am_michael", speed=1.06):
    global _sess, _tok, _voices
    if _sess is None:
        import onnxruntime as ort
        from kokoro_onnx.tokenizer import Tokenizer
        _tok = Tokenizer()
        _sess = ort.InferenceSession(os.path.join(TTSDIR, "kokoro-model.onnx"))
        _voices = np.load(os.path.join(TTSDIR, "voices.npz"))
    text = text.replace("\n", " ").strip()
    ph = _tok.phonemize(text, lang="en-us")
    tokens = _tok.tokenize(ph)
    out = []
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


# ---------------------------------------------------------------- music (soft ambient pad)
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(n, o):
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o - 4) - 9) / 12)


def pad(freqs, dur, vol):
    t = np.arange(int(dur * SR)) / SR
    a = min(1.2, dur / 3)
    env = np.minimum(t / a, 1.0) * np.minimum(1.0, (dur - t) / 1.2 + 0.0)
    env = np.clip(env, 0, 1)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (0.997, 1.0, 1.004):
            x += np.sin(2 * np.pi * f * det * t + random.random())
        x += 0.15 * np.sin(2 * np.pi * f * 0.5 * t)  # sub
    return vol * env * x / (len(freqs) * 3)


PROG = [  # Cmaj7 - Em7 - Am7 - Fmaj7, slow
    [("C", 3), ("E", 3), ("G", 3), ("B", 3)],
    [("E", 3), ("G", 3), ("B", 3), ("D", 4)],
    [("A", 2), ("C", 3), ("E", 3), ("G", 3)],
    [("F", 2), ("A", 3), ("C", 4), ("E", 4)],
]


def music_bed(total):
    bar = 4.6
    n = int(total * SR) + SR
    out = np.zeros(n)
    t0, i = 0.0, 0
    while t0 < total:
        ch = [freq(*x) for x in PROG[i % 4]]
        seg = pad(ch, bar + 0.6, 0.5)
        s = int(t0 * SR)
        end = min(n, s + len(seg))
        out[s:end] += seg[:end - s]
        t0 += bar
        i += 1
    return out[:int(total * SR)]


# ---------------------------------------------------------------- palette / drawing
BG_TOP, BG_BOT = "#0E1220", "#161B2E"
FG = (233, 236, 245)
SUB = (150, 160, 185)
CARBON = (150, 158, 178)
ATOM = {"N": "#4C8BF5", "O": "#FF5C5C", "S": "#F2C14E", "P": "#F08A3C",
        "C": "#9AA2B8", "Np": "#5A9BFF"}


def hx(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def bg_image(seed=1):
    top, bot = np.array(hx(BG_TOP), float), np.array(hx(BG_BOT), float)
    col = np.linspace(top, bot, H * SS).astype(np.uint8)
    arr = np.repeat(col[:, None, :], W * SS, axis=1)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    r = random.Random(seed)
    for _ in range(70):  # faint synapse dots
        x, y = r.randint(0, W * SS), r.randint(0, H * SS)
        rr = r.choice([2, 3, 4])
        c = r.choice([(40, 60, 110), (60, 45, 90), (35, 70, 90)])
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=c)
    return img


def F(sz, reg=False):
    return ImageFont.truetype(FONT_R if reg else FONT, int(sz * SS))


def text(d, xy, s, sz, fill=FG, anchor="lm", reg=False, stroke=0, sfill=(0, 0, 0)):
    d.text((xy[0] * SS, xy[1] * SS), s, font=F(sz, reg), fill=fill, anchor=anchor,
           stroke_width=int(stroke * SS), stroke_fill=sfill)


def rounded(d, box, rad, fill=None, outline=None, wdt=2):
    d.rounded_rectangle([box[0] * SS, box[1] * SS, box[2] * SS, box[3] * SS],
                        radius=rad * SS, fill=fill, outline=outline, width=int(wdt * SS))


# ---- molecule engine: skeletal formula (carbons implicit at vertices) ----
def benzene(cx, cy, r, rot=0):
    pts = []
    for i in range(6):
        a = math.radians(rot + 60 * i + 90)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def penta(cx, cy, r, rot=0):
    pts = []
    for i in range(5):
        a = math.radians(rot + 72 * i + 90)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def draw_molecule(d, atoms, bonds, cx, cy, scale, accent):
    """atoms: list of (x,y,label|None). bonds: (i,j,order)."""
    P = [(cx + x * scale, cy + y * scale) for (x, y, _) in atoms]

    def perp(p, q, off):
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy) or 1
        return (-dy / L * off, dx / L * off)

    for (i, j, order) in bonds:
        p, q = P[i], P[j]
        if order == 1:
            d.line([p[0] * SS, p[1] * SS, q[0] * SS, q[1] * SS], fill=CARBON, width=5 * SS)
        elif order == 2:
            ox, oy = perp(p, q, 6)
            for s in (1, -1):
                d.line([(p[0] + s * ox) * SS, (p[1] + s * oy) * SS,
                        (q[0] + s * ox) * SS, (q[1] + s * oy) * SS], fill=CARBON, width=4 * SS)
        elif order == 3:  # aromatic hint: inner line
            d.line([p[0] * SS, p[1] * SS, q[0] * SS, q[1] * SS], fill=CARBON, width=5 * SS)
            ox, oy = perp(p, q, 7)
            mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
            d.line([(p[0] * 0.7 + q[0] * 0.3 + ox) * SS, (p[1] * 0.7 + q[1] * 0.3 + oy) * SS,
                    (p[0] * 0.3 + q[0] * 0.7 + ox) * SS, (p[1] * 0.3 + q[1] * 0.7 + oy) * SS],
                   fill=CARBON, width=3 * SS)
    for idx, (x, y, lab) in enumerate(atoms):
        if not lab:
            continue
        px, py = P[idx]
        el = lab[0] if lab[0] in ATOM else "C"
        col = hx(ATOM.get(lab, ATOM.get(el, "#9AA2B8")))
        rad = 20 + 5 * (len(lab) - 1)
        d.ellipse([(px - rad) * SS, (py - rad) * SS, (px + rad) * SS, (py + rad) * SS],
                  fill=col, outline=(15, 18, 30), width=3 * SS)
        text(d, (px, py + 1), lab, 26 if len(lab) <= 2 else 21, fill=(15, 18, 30), anchor="mm")


# ---- molecule structures (schematic skeletal; heteroatoms labeled) ----
def m_catecholamine(extra_oh=False, n_methyl=False):
    b = benzene(0, 0, 1.0)
    atoms = [(x, y, None) for (x, y) in b]
    bonds = [(i, (i + 1) % 6, 2 if i % 2 == 0 else 1) for i in range(6)]
    # two OH on adjacent ring carbons (catechol) at v3,v4 (lower left)
    atoms.append((b[3][0] - 0.9, b[3][1] + 0.5, "O"))
    bonds.append((3, len(atoms) - 1, 1))
    atoms.append((b[4][0] - 0.2, b[4][1] + 1.1, "O"))
    bonds.append((4, len(atoms) - 1, 1))
    # tail off v0 (top)
    c1 = (b[0][0] + 0.9, b[0][1] - 0.55)
    atoms.append((c1[0], c1[1], None)); bonds.append((0, len(atoms) - 1, 1)); i_c1 = len(atoms) - 1
    if extra_oh:
        atoms.append((c1[0] + 0.2, c1[1] - 1.05, "O")); bonds.append((i_c1, len(atoms) - 1, 1))
    c2 = (c1[0] + 0.9, c1[1] + 0.5)
    atoms.append((c2[0], c2[1], None)); bonds.append((i_c1, len(atoms) - 1, 1)); i_c2 = len(atoms) - 1
    nlab = "NH" if n_methyl else "NH2"
    atoms.append((c2[0] + 0.95, c2[1] - 0.5, nlab)); bonds.append((i_c2, len(atoms) - 1, 1)); i_n = len(atoms) - 1
    if n_methyl:
        atoms.append((c2[0] + 1.9, c2[1] - 0.05, None)); bonds.append((i_n, len(atoms) - 1, 1))
    return atoms, bonds


def m_dopamine():
    return m_catecholamine()


def m_norepinephrine():
    return m_catecholamine(extra_oh=True)


def m_epinephrine():
    return m_catecholamine(extra_oh=True, n_methyl=True)


def m_serotonin():
    # indole: benzene fused with pyrrole (5-ring containing N)
    b = benzene(-0.5, 0, 1.0)
    atoms = [(x, y, None) for (x, y) in b]
    bonds = [(i, (i + 1) % 6, 2 if i % 2 == 0 else 1) for i in range(6)]
    # fuse pyrrole on v5-v0 edge (right side)
    n = (b[0][0] + 1.5, b[0][1] - 0.35)
    c_a = (b[5][0] + 1.5, b[5][1] + 0.35)
    mid = (b[0][0] + 2.1, (b[0][1] + b[5][1]) / 2)
    atoms.append((n[0], n[1], "N")); i_n = len(atoms) - 1
    atoms.append((mid[0], mid[1], None)); i_m = len(atoms) - 1
    atoms.append((c_a[0], c_a[1], None)); i_a = len(atoms) - 1
    bonds += [(0, i_n, 1), (i_n, i_m, 1), (i_m, i_a, 2), (i_a, 5, 1)]
    # OH on benzene v3
    atoms.append((b[3][0] - 0.9, b[3][1] + 0.3, "O")); bonds.append((3, len(atoms) - 1, 1))
    # ethylamine off i_m
    c1 = (mid[0] + 0.95, mid[1] - 0.5)
    atoms.append((c1[0], c1[1], None)); bonds.append((i_m, len(atoms) - 1, 1)); i_c1 = len(atoms) - 1
    atoms.append((c1[0] + 0.9, c1[1] + 0.5, None)); bonds.append((i_c1, len(atoms) - 1, 1)); i_c2 = len(atoms) - 1
    atoms.append((c1[0] + 1.85, c1[1], "NH2")); bonds.append((i_c2, len(atoms) - 1, 1))
    return atoms, bonds


def chain(spec, x0=-2.2, y0=0.0, dx=0.95, dy=0.55):
    """spec: list of labels (None for carbon). zigzag chain."""
    atoms, bonds = [], []
    x, y = x0, y0
    for i, lab in enumerate(spec):
        atoms.append((x, y, lab))
        if i > 0:
            bonds.append((i - 1, i, 1))
        x += dx
        y = y0 + (dy if (i % 2 == 0) else 0)
    return atoms, bonds


def m_gaba():
    a, b = chain([None, None, None, None, "O"])  # backbone + carboxyl O
    # NH2 on first carbon
    a[0] = (a[0][0], a[0][1], None)
    a.insert(0, (a[0][0] - 0.95, a[0][1] + 0.5, "NH2"))
    b = [(i + 1, j + 1, o) for (i, j, o) in b]
    b.insert(0, (0, 1, 1))
    # carbonyl double O on last carbon
    a.append((a[-1][0] - 0.1, a[-1][1] - 1.05, "O"))
    b.append((len(a) - 3, len(a) - 1, 2))
    return a, b


def m_glutamate():
    a, b = chain([None, None, None, None, "O"], x0=-2.6)
    a.insert(0, (a[0][0] - 0.95, a[0][1] + 0.5, "NH2"))
    b = [(i + 1, j + 1, o) for (i, j, o) in b]
    b.insert(0, (0, 1, 1))
    a.append((a[-1][0] - 0.1, a[-1][1] - 1.05, "O")); b.append((len(a) - 3, len(a) - 1, 2))
    # second carboxyl off carbon index 2
    a.append((a[2][0] + 0.1, a[2][1] - 1.1, "O")); b.append((2, len(a) - 1, 2))
    a.append((a[2][0] - 0.9, a[2][1] - 1.4, "O")); b.append((2, len(a) - 1, 1))
    return a, b


def m_glycine():
    a = [(-1.4, 0.5, "NH2"), (-0.5, 0, None), (0.45, 0.5, None), (1.4, 0, "O"), (0.55, -1.05, "O")]
    b = [(0, 1, 1), (1, 2, 1), (2, 3, 1), (2, 4, 2)]
    return a, b


def m_acetylcholine():
    a = [(-2.4, 0.4, "N"), (-1.5, -0.1, None), (-0.55, 0.4, None), (0.4, -0.1, "O"),
         (1.35, 0.4, None), (2.3, -0.1, None), (1.45, 1.45, "O")]
    b = [(0, 1, 1), (1, 2, 1), (2, 3, 1), (3, 4, 1), (4, 5, 1), (4, 6, 2)]
    # three methyls on N (quaternary)
    for dxo, dyo in [(-0.9, -0.5), (-0.9, 0.6), (-0.2, -1.0)]:
        a.append((a[0][0] + dxo, a[0][1] + dyo, None)); b.append((0, len(a) - 1, 1))
    return a, b


def m_histamine():
    p = penta(-1.2, 0, 0.95)
    atoms = [(x, y, None) for (x, y) in p]
    # imidazole: N at positions 1 and 3
    atoms[1] = (p[1][0], p[1][1], "N")
    atoms[3] = (p[3][0], p[3][1], "N")
    bonds = [(0, 1, 1), (1, 2, 2), (2, 3, 1), (3, 4, 2), (4, 0, 1)]
    # ethylamine tail off atom 0
    c1 = (p[0][0] + 0.95, p[0][1] - 0.5)
    atoms.append((c1[0], c1[1], None)); bonds.append((0, len(atoms) - 1, 1)); i1 = len(atoms) - 1
    atoms.append((c1[0] + 0.9, c1[1] + 0.5, None)); bonds.append((i1, len(atoms) - 1, 1)); i2 = len(atoms) - 1
    atoms.append((c1[0] + 1.85, c1[1], "NH2")); bonds.append((i2, len(atoms) - 1, 1))
    return atoms, bonds


def m_adenosine():
    # purine: fused 6-ring (pyrimidine) + 5-ring (imidazole), 4 N
    b6 = benzene(-1.6, 0, 0.95)
    atoms = [(x, y, None) for (x, y) in b6]
    atoms[1] = (b6[1][0], b6[1][1], "N")
    atoms[3] = (b6[3][0], b6[3][1], "N")
    bonds = [(i, (i + 1) % 6, 2 if i % 2 == 0 else 1) for i in range(6)]
    # NH2 on b6[2]
    atoms.append((b6[2][0] - 0.9, b6[2][1] + 0.3, "NH2")); bonds.append((2, len(atoms) - 1, 1))
    # fuse 5-ring on edge v5-v0
    n7 = (b6[0][0] + 1.4, b6[0][1] - 0.4); c8 = (b6[0][0] + 2.0, (b6[0][1] + b6[5][1]) / 2)
    n9 = (b6[5][0] + 1.4, b6[5][1] + 0.4)
    atoms.append((n7[0], n7[1], "N")); i7 = len(atoms) - 1
    atoms.append((c8[0], c8[1], None)); i8 = len(atoms) - 1
    atoms.append((n9[0], n9[1], "N")); i9 = len(atoms) - 1
    bonds += [(0, i7, 1), (i7, i8, 2), (i8, i9, 1), (i9, 5, 1)]
    # ribose (5-ring with O) off n9
    r = penta(n9[0] + 1.15, n9[1] + 0.6, 0.8, rot=10)
    base = len(atoms)
    for k, (x, y) in enumerate(r):
        atoms.append((x, y, "O" if k == 0 else None))
    for k in range(5):
        bonds.append((base + k, base + (k + 1) % 5, 1))
    bonds.append((i9, base + 2, 1))
    atoms.append((r[3][0] + 0.6, r[3][1] + 0.7, "O")); bonds.append((base + 3, len(atoms) - 1, 1))
    return atoms, bonds


def m_anandamide():
    # long fatty chain with cis kinks + amide head + ethanol
    atoms, bonds = [], []
    x, y = -4.6, 0.3
    n = 16
    for i in range(n):
        yy = y + (0.5 if i % 2 == 0 else 0.0)
        if i in (4, 7, 10, 13):
            yy += 0.0
        atoms.append((x, yy, None))
        if i > 0:
            order = 2 if i in (5, 8, 11, 14) else 1
            bonds.append((i - 1, i, order))
        x += 0.62
    # amide: C(=O)-N-CH2-CH2-OH
    cA = (x, y + 0.3); atoms.append((cA[0], cA[1], None)); bonds.append((n - 1, len(atoms) - 1, 1)); iC = len(atoms) - 1
    atoms.append((cA[0], cA[1] - 1.0, "O")); bonds.append((iC, len(atoms) - 1, 2))
    atoms.append((cA[0] + 0.9, cA[1] + 0.5, "N")); bonds.append((iC, len(atoms) - 1, 1)); iN = len(atoms) - 1
    atoms.append((cA[0] + 1.8, cA[1], None)); bonds.append((iN, len(atoms) - 1, 1)); iE = len(atoms) - 1
    atoms.append((cA[0] + 2.7, cA[1] + 0.5, "O")); bonds.append((iE, len(atoms) - 1, 1))
    return atoms, bonds


def draw_peptide(d, cx, cy, scale, n_res, accent, cyclic=False, ss_bridge=False):
    """Cartoon peptide: chain/ring of amino-acid beads."""
    pts = []
    if cyclic:
        for i in range(n_res):
            a = 2 * math.pi * i / n_res - math.pi / 2
            pts.append((cx + math.cos(a) * scale, cy + math.sin(a) * scale))
    else:
        x = cx - scale * 1.4
        for i in range(n_res):
            pts.append((x, cy + (scale * 0.35 if i % 2 else -scale * 0.35)))
            x += scale * 2.8 / max(1, n_res - 1)
    order = list(range(n_res)) + ([0] if cyclic else [])
    for a, b in zip(order, order[1:]):
        d.line([pts[a][0] * SS, pts[a][1] * SS, pts[b][0] * SS, pts[b][1] * SS],
               fill=CARBON, width=6 * SS)
    for i, (px, py) in enumerate(pts):
        r = scale * 0.22
        d.ellipse([(px - r) * SS, (py - r) * SS, (px + r) * SS, (py + r) * SS],
                  fill=hx(accent), outline=(15, 18, 30), width=3 * SS)
    if ss_bridge and n_res >= 6:  # disulfide bond hint across the ring
        a, b = pts[0], pts[5 % n_res]
        d.line([a[0] * SS, a[1] * SS, b[0] * SS, b[1] * SS], fill=hx("#F2C14E"),
               width=4 * SS)


MOLS = {
    "glutamate": m_glutamate, "gaba": m_gaba, "dopamine": m_dopamine,
    "serotonin": m_serotonin, "norepinephrine": m_norepinephrine,
    "epinephrine": m_epinephrine, "acetylcholine": m_acetylcholine,
    "histamine": m_histamine, "glycine": m_glycine, "adenosine": m_adenosine,
    "anandamide": m_anandamide,
}
PEPTIDES = {"endorphins": dict(n_res=5, cyclic=False),
            "oxytocin": dict(n_res=9, cyclic=True, ss_bridge=True)}

TAG_COL = {"excitatory": "#FF7A45", "inhibitory": "#4CC9F0", "modulatory": "#B15CF0",
           "neuropeptide": "#F063A4", "hormone / nt": "#FF5C5C",
           "endocannabinoid": "#9D8DF1"}

# (key, display, accent, tag, [bullets], narration)
NT = [
    ("glutamate", "Glutamate", "#FFA94D", "excitatory",
     ['main "GO" signal', "learning & memory", "too much = toxic"],
     "We'll start with the loudest one. Glutamate is the brain's main excitatory neurotransmitter, the go signal, used at the majority of your synapses. Almost every memory you form and every skill you learn depends on glutamate strengthening the connections between neurons. The catch: too much of it is toxic. Overload a neuron with glutamate and it can literally excite itself to death, which is a big part of the damage done by strokes."),
    ("gaba", "GABA", "#4CC9F0", "inhibitory",
     ["the brakes", "calms & relaxes", "boosted by alcohol & Xanax"],
     "For every go, you need a stop. That's GABA, the main inhibitory neurotransmitter, the brakes of the nervous system. It quiets neurons down and stops the whole system from overheating into a seizure. It's also why you relax: alcohol, benzodiazepines like Xanax, and many sleep aids all work by boosting GABA. Too little of it, and you get anxiety, restlessness, and in the extreme, convulsions."),
    ("dopamine", "Dopamine", "#F063A4", "modulatory",
     ["motivation & reward", "controls movement", "low = Parkinson's"],
     "Now the famous one. Dopamine is not the pleasure chemical. It's the motivation and reward-prediction chemical. It spikes when you expect something good, and drives you to actually go get it. It also runs smooth, deliberate movement. Lose the dopamine neurons in a region called the substantia nigra, and you get Parkinson's disease. Hijack the reward pathway, and you get addiction."),
    ("serotonin", "Serotonin", "#51CF66", "modulatory",
     ["mood, sleep, appetite", "~90% lives in the gut", "target of SSRIs"],
     "Serotonin gets called the happiness molecule, which is only half true. It helps regulate mood, but also sleep, appetite, and digestion. In fact, about ninety percent of it lives in your gut, not your brain. It's the target of the most common antidepressants, S-S-R-Is, which stop your neurons from vacuuming it back up too quickly."),
    ("norepinephrine", "Norepinephrine", "#FF8787", "modulatory",
     ["alertness & focus", "fight-or-flight", "aka noradrenaline"],
     "Norepinephrine, also called noradrenaline, is your alertness dial. It sharpens attention, ramps up arousal, and helps drive the fight-or-flight response. That jolt of focus you get the instant something goes wrong? That's norepinephrine. It's also why some A-D-H-D medications target it, to improve concentration."),
    ("epinephrine", "Epinephrine", "#FF5C5C", "hormone / nt",
     ["adrenaline", "the panic button", "from the adrenal glands"],
     "Its close cousin is epinephrine, adrenaline. This one is mostly a hormone, dumped into your blood by the adrenal glands, but it moonlights as a neurotransmitter too. It's the full-body panic button: heart pounding, pupils wide, sugar flooding your muscles. Fantastic for outrunning a bear. Less ideal during a job interview."),
    ("acetylcholine", "Acetylcholine", "#FFD43B", "excitatory",
     ["first NT discovered", "moves your muscles", "low in Alzheimer's"],
     "Acetylcholine was the very first neurotransmitter ever discovered. It does two big jobs. Out in the body, it tells your muscles to contract. Every single step you take is acetylcholine firing. In the brain, it's crucial for attention and memory. It's also the neurotransmitter that steadily dies off in Alzheimer's disease."),
    ("endorphins", "Endorphins", "#B15CF0", "neuropeptide",
     ["natural painkillers", '"runner\'s high"', "same receptors as opioids"],
     "Endorphins are your body's built-in painkillers. The name literally means endogenous morphine. They flood your system during pain, stress, exercise, and even laughter, dulling discomfort and producing that warm runner's high. They bind to the exact same receptors as opioid drugs like morphine and heroin, which is precisely why those drugs are so powerful, and so dangerous."),
    ("oxytocin", "Oxytocin", "#FF80B5", "neuropeptide",
     ["bonding & trust", "childbirth & nursing", 'not pure "cuddles"'],
     "Oxytocin is the bonding molecule. It surges during hugs, sex, childbirth, and nursing, building trust and attachment between people. It's a big part of how a parent bonds with a newborn. But it isn't pure love and cuddles. It can also sharpen loyalty to your own group and suspicion of outsiders. It bonds you to your people, whoever you've decided your people are."),
    ("histamine", "Histamine", "#A9E34B", "modulatory",
     ["keeps you awake", "allergy response", "why allergy pills = drowsy"],
     "You know histamine from allergies, but inside the brain it's a wakefulness signal. It helps keep you alert and awake. That's exactly why antihistamine allergy pills make you drowsy: they're accidentally switching off your brain's stay-awake system along with your runny nose."),
    ("glycine", "Glycine", "#74C0FC", "inhibitory",
     ["simplest amino acid", "calms the spinal cord", "plays both sides"],
     "Glycine is the simplest amino acid, and a quiet inhibitory neurotransmitter, working mostly in your spinal cord and brainstem to control movement and reflexes. Oddly, it plays for both teams. It also helps glutamate switch on certain receptors. Block glycine, the way the poison strychnine does, and your muscles lose their brakes and lock up in spasms."),
    ("anandamide", "Anandamide", "#9D8DF1", "endocannabinoid",
     ['the "bliss molecule"', "your own cannabis signal", "mood & appetite"],
     "Anandamide is nicknamed the bliss molecule, after the Sanskrit word for joy. It's an endocannabinoid, meaning it binds the very same receptors that T-H-C in cannabis does. Your brain makes its own cannabis-like signal to help regulate mood, appetite, memory, and pain. And it's part of what's behind that mellow, floaty runner's high, too."),
    ("adenosine", "Adenosine", "#7C8CFF", "modulatory",
     ["sleep pressure", "builds up while awake", "blocked by caffeine"],
     "And finally, the reason you're tired. While you're awake, adenosine slowly builds up in your brain, and the more of it accumulates, the sleepier you feel. It's your body keeping score of how long you've been up. Caffeine works by plugging into adenosine's receptors and blocking them. Coffee doesn't actually give you energy. It just hides how tired you already are."),
]

INTRO = "Your brain runs on chemistry. Around eighty-six billion neurons, and almost none of them actually touch. They shout across microscopic gaps using molecules called neurotransmitters. There are dozens of them, and each one shapes how you think, feel, move, and sleep. So let's go through the major ones, one at a time."
OUTRO = "And that's a tour of your brain's chemical messengers. Dozens of molecules, no single one for happy or sad, all working in a constant, shifting balance. Every mood, every memory, every movement is really just chemistry, negotiating. Thanks for watching."


def ease(p):
    if p >= 1:
        return 1.0
    if p < 0:
        return 0.0
    return 1 - (1 - p) ** 3


def caption(d, s):
    if not s:
        return
    cf = F(36)
    words, lines, cur = s.split(), [], ""
    while words:
        w_ = words.pop(0)
        t = (cur + " " + w_).strip()
        if d.textlength(t, font=cf) <= 1560 * SS:
            cur = t
        else:
            lines.append(cur); cur = w_
    lines.append(cur)
    y = (1012 - len(lines) * 48) * SS
    for ln in lines:
        d.text((W * SS / 2, y), ln, font=cf, fill=(238, 240, 248), anchor="ma",
               stroke_width=3 * SS, stroke_fill=(6, 8, 16))
        y += 48 * SS


def draw_molecule_hero(d, key, cx, cy, accent):
    if key in MOLS:
        atoms, bonds = MOLS[key]()
        # auto-fit scale
        xs = [a[0] for a in atoms]; ys = [a[1] for a in atoms]
        span = max(max(xs) - min(xs), max(ys) - min(ys), 1)
        ox = (min(xs) + max(xs)) / 2; oy = (min(ys) + max(ys)) / 2
        atoms = [(x - ox, y - oy, l) for (x, y, l) in atoms]
        scale = 420 / span
        draw_molecule(d, atoms, bonds, cx, cy, scale, accent)
    elif key in PEPTIDES:
        draw_peptide(d, cx, cy, 150, accent=accent, **PEPTIDES[key])


def render_nt_frame(bg_img, idx_disp, disp, accent, tag, bullets, key, cap, t, dur):
    img = bg_img.copy()
    d = ImageDraw.Draw(img, "RGBA")
    ac = hx(accent)
    # left accent bar
    d.rectangle([0, 0, 14 * SS, H * SS], fill=ac)
    # progress counter
    text(d, (1850, 70), f"{idx_disp:02d} / 13", 40, fill=SUB, anchor="rm")
    # molecule panel (left)
    panel = (110, 235, 880, 770)
    rounded(d, panel, 28, fill=(255, 255, 255, 10), outline=(*ac, 120), wdt=2)
    mol_p = min(1.0, (t) / 0.5)
    if mol_p > 0:
        draw_molecule_hero(d, key, 495, 500, accent)
    # name + tag + bullets (right)
    nx = 965
    ny = 300
    p_name = ease(t / 0.4)
    if p_name > 0:
        text(d, (nx, ny), disp, 92 * (0.85 + 0.15 * p_name), fill=ac, anchor="lm")
    # tag pill
    if t > 0.35:
        tw = ImageDraw.Draw(img).textlength(tag.upper(), font=F(28))
        rounded(d, (nx, ny + 58, nx + tw / SS + 42, ny + 110), 24,
                fill=(*hx(TAG_COL.get(tag, accent)), 46), outline=(*hx(TAG_COL.get(tag, accent)), 200), wdt=2)
        text(d, (nx + 21, ny + 85), tag.upper(), 28, fill=hx(TAG_COL.get(tag, accent)), anchor="lm")
    # bullets
    by = ny + 190
    for i, bl in enumerate(bullets):
        bt = 0.55 + i * 0.28
        if t > bt * 0.9:
            pp = ease((t - bt * 0.9) / 0.35)
            xoff = (1 - pp) * 40
            d.ellipse([(nx + 4) * SS, (by - 11) * SS, (nx + 26) * SS, (by + 11) * SS],
                      fill=(*ac, int(255 * pp)))
            text(d, (nx + 52 + xoff, by), bl, 44, fill=(*FG, ), anchor="lm")
        by += 84
    caption(d, cap)
    return img.resize((W, H), Image.LANCZOS)


def render_title_frame(bg_img, t, kind):
    img = bg_img.copy()
    d = ImageDraw.Draw(img, "RGBA")
    if kind == "intro":
        p = ease(t / 0.6)
        text(d, (960, 430), "EVERY", 70 * (0.9 + 0.1 * p), fill=SUB, anchor="mm")
        text(d, (960, 540), "NEUROTRANSMITTER", 118, fill=FG, anchor="mm")
        if t > 0.5:
            text(d, (960, 650), "explained", 64, fill=hx("#7C8CFF"), anchor="mm", reg=True)
        # molecule doodles floating
        if t > 0.8:
            draw_molecule(d, *m_dopamine(), 360, 860, 70, "#F063A4")
            draw_molecule(d, *m_serotonin(), 1560, 850, 62, "#51CF66")
    else:  # outro
        text(d, (960, 470), "13 messengers.", 92, fill=FG, anchor="mm")
        text(d, (960, 590), "one shifting balance.", 92, fill=hx("#7C8CFF"), anchor="mm")
        if t > 0.6:
            text(d, (960, 730), "thanks for watching", 50, fill=SUB, anchor="mm", reg=True)
    return img.resize((W, H), Image.LANCZOS)


def render_segment(idx, kind, payload, cap, dur, wav):
    nf = max(int(dur * FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS_R), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS_O), "-c:a", "aac", "-b:a", "160k",
         "-t", f"{dur:.3f}", mp4], stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bgi = bg_image(seed=idx + 3)
    for fi in range(nf):
        t = fi / FPS_R
        if kind in ("intro", "outro"):
            frame = render_title_frame(bgi, t, kind)
        else:
            (idx_disp, disp, accent, tag, bullets, key) = payload
            frame = render_nt_frame(bgi, idx_disp, disp, accent, tag, bullets, key, cap, t, dur)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    return mp4


def main():
    random.seed(5)
    segs = [("intro", None, INTRO)]
    for i, (key, disp, accent, tag, bullets, narr) in enumerate(NT, 1):
        segs.append(("nt", (i, disp, accent, tag, bullets, key), narr))
    segs.append(("outro", None, OUTRO))

    seg_files, durations = [], []
    for i, (kind, payload, narr) in enumerate(segs):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        if os.path.exists(done):
            durations.append(len(read_wav(wav)) / SR)
            seg_files.append(os.path.join(OUT, f"seg{i:03d}.mp4"))
            continue
        v = tts(narr, speed=1.06)
        tail = 0.5 if kind == "nt" else 0.7
        v = np.concatenate([v, np.zeros(int(tail * SR))])
        write_wav(wav, v)
        dur = len(v) / SR
        durations.append(dur)
        render_segment(i, kind, payload, narr if kind == "nt" else "", dur, wav)
        open(done, "w").close()
        print(f"[{i + 1}/{len(segs)}] {kind} {dur:.2f}s", flush=True)

    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{p}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined],
                   check=True, capture_output=True)
    total = sum(durations)
    print(f"total {total:.1f}s", flush=True)
    bed = os.path.join(OUT, "bed.wav")
    write_wav(bed, music_bed(total))
    final = os.path.join(OUT, "every_neurotransmitter_explained.mp4")
    subprocess.run(["ffmpeg", "-y", "-i", joined, "-i", bed, "-filter_complex",
                    "[1:a]volume=0.11[m];[0:a]volume=1.35[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final],
                   check=True, capture_output=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
