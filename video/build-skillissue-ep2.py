#!/usr/bin/env python3
"""SKILL ISSUE — ep.2: "You Too"

Plainer language, slower pacing, less on screen than ep1. Reuses ep1's
infra/aesthetic from build_skillissue.
"""
import math
import os
import subprocess

import numpy as np

import build_skillissue as si

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skill_out2")
os.makedirs(OUT, exist_ok=True)
si.OUT = OUT  # so any helper writing here is scoped

SS = si.SS
W, H = si.W, si.H
GREEN, RED, AMBER, CYAN, DIM, FG = si.GREEN, si.RED, si.AMBER, si.CYAN, si.DIM, si.FGX


def T(d, xy, s, sz, **k):
    si.T(d, xy, s, sz, **k)


# ---- plain-language content, short beats ----
# (kind, narration)
SCENES = [
    ("boot",
     "Incident number two. Nobody got hurt. Everybody was a little embarrassed."),
    ("what",
     "Here is what happened. You were at a restaurant. The waiter brought your food, smiled, and said the most dangerous sentence in the world. Enjoy your meal."),
    ("moment",
     "And you panicked. The waiter said, enjoy your meal. Your mouth said... you too. But the waiter is not eating. The waiter is working. You just told them to enjoy the food they are carrying to someone else."),
    ("howbad",
     "So how bad was it? Honestly? Not that bad. Three people heard it. You will forget it never. Everyone else forgot it in about four seconds."),
    ("why",
     "Why does this happen? Simple. Your brain wasn't really listening. It was on autopilot. It heard something friendly, grabbed the nearest friendly reply, and said it before you could stop it. You too is the autopilot answer. Fast, polite, and sometimes, completely wrong."),
    ("recovery",
     "What did you do next? The classic move. You thought about explaining. You decided not to. You looked at your food very hard, and you both quietly agreed to never mention it again. That was the right call."),
    ("outro",
     "The verdict? Not your fault. Your brain did it, you were just standing there. Everyone has said you too to the wrong thing. Happy birthday. Enjoy the flight. You're under arrest. It happens. Case closed. See you next time."),
]


# ---------------------------------------------------------------- ep2 visuals
def big_lines(d, lines, cy, sz=64, gap=90, cols=None, reveal_from=0.0, t=0.0, step=0.5):
    y = cy - (len(lines) - 1) * gap / 2
    for i, ln in enumerate(lines):
        if t < reveal_from + i * step:
            y += gap; continue
        c = (cols[i] if cols else FG)
        T(d, (960, y), ln, sz, fill=c, anchor="mm")
        y += gap


def draw_brain(d, cx, cy, t):
    # cute brain blob
    for (ox, oy, r) in [(-70, -10, 95), (70, -10, 95), (0, -50, 90), (0, 40, 85)]:
        d.ellipse([(cx + ox - r) * SS, (cy + oy - r) * SS, (cx + ox + r) * SS, (cy + oy + r) * SS],
                  fill=si.hx("#F2A0A0") if False else (242, 160, 160))
    d.ellipse([(cx - 150) * SS, (cy - 110) * SS, (cx + 150) * SS, (cy + 120) * SS],
              outline=(255, 210, 210), width=3 * SS)
    # squiggles
    import random
    rr = random.Random(2)
    for _ in range(6):
        x0 = cx + rr.randint(-110, 90); y0 = cy + rr.randint(-80, 80)
        d.arc([x0 * SS, y0 * SS, (x0 + 60) * SS, (y0 + 40) * SS], 0, 260, fill=(200, 120, 120), width=4 * SS)
    # autopilot toggle
    tx, ty = cx, cy - 175
    T(d, (tx, ty - 6), "AUTOPILOT", 30, fill=DIM, anchor="mm")
    d.rounded_rectangle([(tx + 130) * SS, (ty - 22) * SS, (tx + 220) * SS, (ty + 22) * SS],
                        radius=22 * SS, fill=(*GREEN, 60), outline=GREEN, width=3 * SS)
    d.ellipse([(tx + 180) * SS, (ty - 18) * SS, (tx + 216) * SS, (ty + 18) * SS], fill=GREEN)
    T(d, (tx + 300, ty), "ON", 30, fill=GREEN, anchor="mm")


def arrow(d, x1, y1, x2, y2, col, w=8):
    d.line([x1 * SS, y1 * SS, x2 * SS, y2 * SS], fill=col, width=int(w * SS))
    a = math.atan2(y2 - y1, x2 - x1)
    for da in (2.5, -2.5):
        d.line([x2 * SS, y2 * SS, (x2 - 20 * math.cos(a + da)) * SS, (y2 - 20 * math.sin(a + da)) * SS],
               fill=col, width=int(w * SS))


def draw_scene(d, img, kind, t, dur):
    si.chrome(d, t, ep_tag="INCIDENT #0002")
    if kind == "boot":
        cur = "_" if int(t * 2) % 2 == 0 else " "
        T(d, (200, 300), "> opening incident" + ("." * (int(t * 3) % 4)), 34, fill=GREEN, anchor="lm", reg=True)
        if t > 0.7:
            T(d, (200, 440), "INCIDENT #0002", 96, fill=FG, anchor="lm")
        if t > 1.2:
            T(d, (200, 570), '"YOU TOO"', 78, fill=CYAN, anchor="lm")
        if t > 1.8:
            si.badge(d, 200, 670, "SEV-1", RED)
            T(d, (380, 693), "the classic", 30, fill=DIM, anchor="lm", reg=True)
        if t > 2.4:
            T(d, (200, 800), "> everybody has done this" + cur, 30, fill=DIM, anchor="lm", reg=True)
    elif kind == "what":
        T(d, (960, 300), "the setup", 40, fill=DIM, anchor="mm", reg=True)
        big_lines(d, ["you're at a restaurant.", "the waiter brings your food.",
                      "they smile and say:"], 470, sz=56, gap=90, t=t, reveal_from=0.3, step=0.7)
        if t > 2.6:
            d.rounded_rectangle([460 * SS, 720 * SS, 1460 * SS, 820 * SS], radius=18 * SS,
                                fill=(*CYAN, 30), outline=CYAN, width=3 * SS)
            T(d, (960, 770), '"enjoy your meal."', 60, fill=CYAN, anchor="mm")
    elif kind == "moment":
        T(d, (960, 250), "the moment", 40, fill=DIM, anchor="mm", reg=True)
        if t > 0.4:
            T(d, (960, 380), 'them:  "enjoy your meal"', 52, fill=DIM, anchor="mm")
        if t > 1.4:
            T(d, (960, 500), 'you:  "you too!"', 74, fill=RED, anchor="mm")
        if t > 3.0:
            T(d, (960, 650), "( the waiter is not eating. )", 44, fill=AMBER, anchor="mm", reg=True)
            T(d, (960, 720), "( the waiter is working. )", 44, fill=AMBER, anchor="mm", reg=True)
    elif kind == "howbad":
        T(d, (960, 250), "how bad was it, really?", 46, fill=DIM, anchor="mm", reg=True)
        rows = [("people who heard it", "3", CYAN),
                ("how embarrassing", "medium", AMBER),
                ("how long they'll remember", "4 seconds", GREEN),
                ("how long YOU'LL remember", "9 years", RED)]
        for i, (lab, val, c) in enumerate(rows):
            if t < 0.5 + i * 0.6:
                continue
            y = 400 + i * 110
            T(d, (300, y), lab, 40, fill=FG, anchor="lm", reg=True)
            T(d, (1620, y), val, 46, fill=c, anchor="rm")
            d.line([300 * SS, (y + 34) * SS, 1620 * SS, (y + 34) * SS], fill=(40, 50, 68), width=2 * SS)
    elif kind == "why":
        T(d, (960, 210), "why it happened", 46, fill=DIM, anchor="mm", reg=True)
        draw_brain(d, 960, 470, t)
        if t > 1.2:
            arrow(d, 330, 470, 740, 470, CYAN)
            T(d, (330, 420), '"enjoy your meal"', 34, fill=CYAN, anchor="lm", reg=True)
            T(d, (330, 520), "(heard)", 28, fill=DIM, anchor="lm", reg=True)
        if t > 2.2:
            arrow(d, 1180, 470, 1600, 470, RED)
            T(d, (1300, 420), '"you too!"', 40, fill=RED, anchor="lm")
            T(d, (1300, 520), "(said, instantly)", 28, fill=DIM, anchor="lm", reg=True)
    elif kind == "recovery":
        T(d, (960, 250), "the recovery", 46, fill=DIM, anchor="mm", reg=True)
        steps = ["thought about explaining...", "decided not to.",
                 "stared at your food.", "agreed to never speak of it again."]
        cols = [DIM, DIM, AMBER, GREEN]
        for i, s in enumerate(steps):
            if t < 0.5 + i * 0.7:
                continue
            y = 420 + i * 110
            T(d, (500, y), ("x " if i < 2 else "✓ ") + s, 50,
              fill=cols[i], anchor="lm")
    elif kind == "outro":
        T(d, (960, 300), "VERDICT", 54, fill=DIM, anchor="mm")
        if t > 0.6:
            T(d, (960, 410), "not your fault.", 78, fill=GREEN, anchor="mm")
        if t > 1.6:
            T(d, (960, 520), "your brain did it. you were just standing there.", 38, fill=FG, anchor="mm", reg=True)
        if t > 2.8:
            for i, s in enumerate(['"happy birthday"', '"enjoy the flight"', '"you\'re under arrest"']):
                x = 420 + i * 380
                d.rounded_rectangle([(x - 170) * SS, 620 * SS, (x + 170) * SS, 690 * SS], radius=16 * SS,
                                    fill=(*AMBER, 34), outline=AMBER, width=2 * SS)
                T(d, (x, 655), s, 30, fill=AMBER, anchor="mm", reg=True)
        if t > 4.0:
            T(d, (960, 762), "SKILL ISSUE", 52, fill=GREEN, anchor="mm")
            T(d, (960, 822), "everything is a production incident", 26, fill=DIM, anchor="mm", reg=True)


def render_segment(idx, kind, cap, dur, wav):
    nf = max(int(dur * si.FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(si.FPS_R), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(si.FPS_O), "-c:a", "aac", "-b:a", "160k",
         "-t", f"{dur:.3f}", mp4], stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    from PIL import ImageDraw
    for fi in range(nf):
        t = fi / si.FPS_R
        img, d = si.bg_frame(t)
        draw_scene(d, img, kind, t, dur)
        si.caption(d, cap)
        proc.stdin.write(img.resize((W, H), __import__("PIL").Image.LANCZOS).tobytes())
    proc.stdin.close(); proc.wait()
    return mp4


def main():
    seg_files, durations = [], []
    for i, (kind, narr) in enumerate(SCENES):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        if os.path.exists(done):
            durations.append(len(si.read_wav(wav)) / si.SR)
            seg_files.append(os.path.join(OUT, f"seg{i:03d}.mp4")); continue
        v = si.tts(narr, speed=0.96)          # slower for clarity
        v = np.concatenate([v, np.zeros(int(0.8 * si.SR))])  # more breathing room
        si.write_wav(wav, v); dur = len(v) / si.SR; durations.append(dur)
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
    total = sum(durations); print(f"total {total:.1f}s", flush=True)
    si.write_wav(os.path.join(OUT, "bed.wav"), si.music_bed(total))
    final = os.path.join(OUT, "skill_issue_ep2_you_too.mp4")
    subprocess.run(["ffmpeg", "-y", "-i", joined, "-i", os.path.join(OUT, "bed.wav"), "-filter_complex",
                    "[1:a]volume=0.13[m];[0:a]volume=1.4[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final],
                   check=True, capture_output=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
