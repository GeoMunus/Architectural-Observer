#!/usr/bin/env python3
"""SKILL ISSUE meme pack — 1080x1080 'incident report' single-panel memes."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skill_out", "memes")
os.makedirs(OUT, exist_ok=True)

MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
MONO_R = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
S = 2
W = H = 1080
BG = (9, 12, 19)
PANEL = (16, 21, 32)
GRID = (22, 28, 40)
DIM = (122, 133, 155)
FG = (223, 230, 242)
GREEN = (61, 220, 132)
RED = (255, 92, 92)
AMBER = (255, 176, 32)
CYAN = (86, 204, 242)

SEVC = {1: RED, 2: AMBER, 3: AMBER, 4: DIM, 5: DIM}


def F(sz, reg=False):
    return ImageFont.truetype(MONO_R if reg else MONO, int(sz * S))


def wrap(d, s, font, maxw):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if d.textlength(t, font=font) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w_
    if cur:
        lines.append(cur)
    return lines


# (incident_id, SEV, incident text, status, flavor stat)
MEMES = [
    (42, 1, 'said "you too" when the waiter said "enjoy your meal"', "RESOLVED — fled the restaurant", "witnesses: 4  ·  recovery: impossible"),
    (1, 1, "waved back at someone who was not waving at you", "RESOLVED — downgraded to a hair-touch", "blast radius: 9m  ·  will replay at 3am"),
    (17, 2, "pushed a door clearly labeled PULL. then did it again.", "RESOLVED — eventually", "attempts: 2  ·  confidence: unearned"),
    (8, 2, "laughed at a joke you didn't hear, then they explained it", "OPEN — had to laugh a second time", "authenticity: 12%"),
    (33, 4, 'typed "hahaha" while completely stone-faced', "WONTFIX — working as intended", "actual expression: none"),
    (5, 1, 'texted "can we talk?" then immediately went to sleep', "SEV-1 raised on the RECIPIENT", "sleep quality (theirs): 0%"),
    (21, 3, "left them on read for 6 hours, replied only \"lol yeah\"", "RESOLVED — trust me it was busy", "effort deployed: 4%"),
    (12, 2, 'said "sorry" to a mannequin. made eye contact first.', "RESOLVED — no witnesses (hopefully)", "the mannequin said nothing"),
    (28, 1, "rehearsed the coffee order. they asked 'for here or to go?'", "SYSTEM CRASH — reboot required", "prepared for: 1 question  ·  received: 2"),
    (9, 2, 'replied "happy birthday!" — they said "have a good weekend"', "OPEN — cannot be unsent", "context: catastrophically missed"),
    (3, 3, "started crossing before the light. had to commit to the jog.", "RESOLVED — the jog was not convincing", "dignity: -3"),
    (55, 1, "went in for a handshake. they went for a hug. you met in the middle. it was neither.", "RESOLVED — a new third thing was invented", "form factor: undefined"),
]


def render(mid, sev, incident, status, stat):
    img = Image.new("RGB", (W * S, H * S), BG)
    d = ImageDraw.Draw(img, "RGBA")
    for x in range(0, W, 54):
        d.line([x * S, 0, x * S, H * S], fill=(*GRID, 110), width=1)
    for y in range(0, H, 54):
        d.line([0, y * S, W * S, y * S], fill=(*GRID, 110), width=1)
    for y in range(0, H, 4):
        d.line([0, y * S, W * S, y * S], fill=(0, 0, 0, 24), width=1)

    # top chrome
    d.rectangle([0, 0, W * S, 78 * S], fill=(12, 16, 25))
    d.text((44 * S, 39 * S), "SKILL ISSUE", font=F(34), fill=GREEN, anchor="lm")
    d.text((312 * S, 40 * S), "// incident report", font=F(26, reg=True), fill=DIM, anchor="lm")
    d.ellipse([(W - 70) * S, (31) * S, (W - 54) * S, (47) * S], fill=RED)

    # ticket panel
    box = (60, 150, 1020, 930)
    d.rounded_rectangle([box[0] * S, box[1] * S, box[2] * S, box[3] * S], radius=22 * S,
                        fill=(*PANEL, 240), outline=(38, 48, 66), width=2 * S)
    # panel title tab
    tab = f"INCIDENT #{mid:04d}"
    tw = 24 + len(tab) * 18
    d.rounded_rectangle([(box[0] + 34) * S, (box[1] - 20) * S, (box[0] + 34 + tw) * S, (box[1] + 20) * S],
                        radius=8 * S, fill=(12, 16, 25), outline=(38, 48, 66), width=2 * S)
    d.text(((box[0] + 46) * S, box[1] * S), tab, font=F(26), fill=CYAN, anchor="lm")

    # SEV badge
    sc = SEVC[sev]
    bl = f"SEV-{sev}"
    bw = 20 + len(bl) * 24
    d.rounded_rectangle([120 * S, 250 * S, (120 + bw) * S, 316 * S], radius=10 * S,
                        fill=(*sc, 44), outline=sc, width=3 * S)
    d.text(((120 + bw / 2) * S, 283 * S), bl, font=F(34), fill=sc, anchor="mm")
    sev_lbl = {1: "critical", 2: "major", 3: "moderate", 4: "minor", 5: "trivial"}[sev]
    d.text(((120 + bw + 28) * S, 283 * S), sev_lbl, font=F(28, reg=True), fill=DIM, anchor="lm")

    # incident text (the meme)
    font = F(58)
    lines = wrap(d, incident, font, 830 * S)
    if len(lines) > 4:
        font = F(48); lines = wrap(d, incident, font, 850 * S)
    lh = int(font.size / S * 1.28)
    y = 400 + (260 - len(lines) * lh) // 2
    d.text((120 * S, (y - 54) * S), "> ", font=font, fill=GREEN, anchor="lm")
    for ln in lines:
        d.text((120 * S, y * S), ln, font=font, fill=FG, anchor="lm")
        y += lh

    # divider
    d.line([120 * S, 748 * S, 960 * S, 748 * S], fill=(38, 48, 66), width=2 * S)
    # status
    scol = GREEN if status.startswith("RESOLVED") or status.startswith("WONTFIX") else (RED if status.startswith("SEV") or status.startswith("SYSTEM") else AMBER)
    d.text((120 * S, 800 * S), "status:", font=F(30, reg=True), fill=DIM, anchor="lm")
    for i, sl in enumerate(wrap(d, status, F(32), 700 * S)):
        d.text((260 * S, (800 + i * 44) * S), sl, font=F(32), fill=scol, anchor="lm")
    # flavor stat
    d.text((120 * S, 888 * S), stat, font=F(24, reg=True), fill=DIM, anchor="lm")

    # footer handle
    d.text((W / 2 * S, 985 * S), "@skillissue.exe  ·  everything is a production incident",
           font=F(26, reg=True), fill=DIM, anchor="mm")

    out = os.path.join(OUT, f"post_{mid:04d}.png")
    img.resize((W, H), Image.LANCZOS).save(out)
    return out


def main():
    paths = [render(*m) for m in MEMES]
    # contact sheet
    cols, rows = 4, 3
    cs = Image.new("RGB", (cols * 360, rows * 360), (5, 7, 12))
    for i, p in enumerate(paths):
        im = Image.open(p).resize((352, 352))
        cs.paste(im, ((i % cols) * 360 + 4, (i // cols) * 360 + 4))
    cs.save(os.path.join(OUT, "_contact_sheet.png"))
    print(f"rendered {len(paths)} memes")


if __name__ == "__main__":
    main()
