#!/usr/bin/env python3
"""THE PIP REPORT — real episode: the Taylor Swift / Travis Kelce wedding.

Grounded in publicly-reported facts (CNN, NPR, CBS): married July 3 2026 at
Madison Square Garden, officiated by Adam Sandler, Dior couture, ~1,000 guests,
purple "JUST MARRIED" billboards outside MSG, Austin Swift "Man of Honor",
Jason Kelce best man. All commentary is opinion/observation about the spectacle;
no invented claims about real people. Reuses build_pipreport visuals.
"""
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw

import build_pipreport as pr
import build_vunderra as v

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tswift_out")
os.makedirs(OUT, exist_ok=True)

SS, W, H, SR = pr.SS, pr.W, pr.H, pr.SR
FPS_R, FPS_O = pr.FPS_R, pr.FPS_O
T, F, rrect, hx = pr.T, pr.F, pr.rrect, pr.hx
pip, chyron, logo_bug, desk, screen = pr.pip, pr.chyron, pr.logo_bug, pr.desk, pr.screen
PURPLE, PINK, TEAL, YELLOW, RED, BLUE, INK = pr.PURPLE, pr.PINK, pr.TEAL, pr.YELLOW, pr.RED, pr.BLUE, pr.INK


def ease(x):
    return 0.0 if x <= 0 else (1.0 if x >= 1 else 1 - (1 - x) ** 3)


# ---- episode-specific visuals ----
def facts_screen(d, t):
    box = (110, 165, 1150, 760)
    screen(d, box, "THE FACTS", PINK)
    rows = [("📅", "married July 3, 2026", TEAL),
            ("🏟", "at Madison Square Garden", BLUE),
            ("🎤", "officiated by Adam Sandler", YELLOW),
            ("👗", "the couple wore Dior couture", PINK),
            ("👥", "~1,000 guests", "#7FB069")]
    for i, (ic, s, c) in enumerate(rows):
        if t < 0.4 + i * 0.5:
            continue
        y = 280 + i * 88
        d.ellipse([(160) * SS, (y - 26) * SS, (212) * SS, (y + 26) * SS], fill=(*hx(c), 60), outline=hx(c), width=2 * SS)
        T(d, (186, y), "•", 40, fill=hx(c), anchor="mm")
        T(d, (250, y), s, 40, fill=(235, 235, 245))


def guest_grid(d, t):
    names = ["Gigi Hadid", "Bradley Cooper", "Selena Gomez", "Hugh Grant",
             "Steven Spielberg", "Tom Brady", "Ed Sheeran", "Chris Rock", "+ ~990 more"]
    cols = [PINK, BLUE, "#7FB069", YELLOW, TEAL, RED, PURPLE, "#E8A0C0", INK]
    for i, nm in enumerate(names):
        if t < 0.3 + i * 0.28:
            continue
        r, c = divmod(i, 3)
        x = 380 + c * 400
        y = 300 + r * 130
        col = cols[i] if isinstance(cols[i], str) else "#8E5BE8"
        rrect(d, (x - 175, y - 42, x + 175, y + 42), 16, fill=(255, 255, 255, 240), outline=hx(col), wdt=3)
        T(d, (x, y), nm, 30, fill=hx(col), anchor="mm")


def billboard_clip(d, t, paused):
    box = (150, 150, 1770, 740)
    rrect(d, box, 16, fill=(10, 10, 20), outline=(70, 70, 90), wdt=4)
    # night skyline
    for (bx, bw, bh) in [(300, 120, 240), (470, 90, 320), (620, 140, 200), (1150, 110, 300),
                         (1320, 150, 240), (1520, 100, 340)]:
        d.rectangle([(bx) * SS, (700 - bh) * SS, (bx + bw) * SS, 700 * SS], fill=(28, 30, 48))
        for wy in range(700 - bh + 20, 700, 40):
            for wx in range(bx + 14, bx + bw - 10, 34):
                if (wx + wy) % 3:
                    d.rectangle([wx * SS, wy * SS, (wx + 12) * SS, (wy + 18) * SS], fill=(255, 214, 120, 200))
    # the big purple billboard
    rrect(d, (720, 250, 1080, 470), 10, fill=(*hx(PURPLE), 255), outline=(255, 255, 255, 160), wdt=4)
    T(d, (900, 320), "JUST", 54, fill=(255, 255, 255), anchor="mm")
    T(d, (900, 400), "MARRIED", 54, fill=(255, 255, 255), anchor="mm")
    # MSG marquee
    rrect(d, (800, 560, 1000, 640), 40, fill=(30, 34, 54), outline=hx(YELLOW), wdt=3)
    T(d, (900, 600), "THE GARDEN", 24, fill=hx(YELLOW), anchor="mm")
    # player bar
    by = 700
    d.line([190 * SS, by * SS, 1730 * SS, by * SS], fill=(90, 90, 110), width=6 * SS)
    prog = 190 + (1730 - 190) * 0.62
    d.line([190 * SS, by * SS, prog * SS, by * SS], fill=hx(PINK), width=6 * SS)
    d.ellipse([(prog - 12) * SS, (by - 12) * SS, (prog + 12) * SS, (by + 12) * SS], fill=hx(PINK))
    d.rectangle([200 * SS, (by + 20) * SS, 214 * SS, (by + 52) * SS], fill=(230, 230, 240))
    d.rectangle([224 * SS, (by + 20) * SS, 238 * SS, (by + 52) * SS], fill=(230, 230, 240))
    T(d, (270, by + 36), "0:47 / 2:15", 26, fill=(200, 200, 215), anchor="lm", reg=True)
    if paused:
        d.ellipse([690 * SS, 230 * SS, 1110 * SS, 490 * SS], outline=hx(RED), width=6 * SS)
        d.line([1110 * SS, 360 * SS, 1250 * SS, 300 * SS], fill=hx(RED), width=5 * SS)
        T(d, (1260, 292), "a billboard.", 32, fill=hx(RED), anchor="lm")
        T(d, (900, 200), "❚❚  PAUSED", 52, fill=(255, 255, 255, 235), anchor="mm")


# ---- scenes: (kind, expr, narration) ----
SCENES = [
    ("intro", "smile",
     "Big one today. On July third, Taylor Swift and Travis Kelce got married. And somehow, so did the rest of us. Emotionally. Against our will. So let's talk about it. Respectfully. And also, as strangers, who were absolutely not invited."),
    ("facts", "smirk",
     "Here are the facts, as reported by roughly every news outlet on planet Earth. The wedding was at Madison Square Garden. It was officiated by Adam Sandler. The couple wore Dior. And there were, reportedly, about a thousand guests. Let me just sit with the first one. Madison Square Garden. She has, reportedly, performed there eight times. So Taylor Swift has now played more shows at her own wedding venue, than most bands play in an entire career."),
    ("guests", "shock",
     "And then, the guest list. Reportedly featuring: Gigi Hadid, Bradley Cooper, Selena Gomez, Hugh Grant, Steven Spielberg, Tom Brady, and Ed Sheeran. This is not a guest list. This is what would happen if one single sneeze took out twelve percent of Hollywood. Somewhere, a paparazzi photographer looked at that building, and simply began to weep."),
    ("sandler", "smile",
     "Now. This is the part I need everyone to slow down for. The wedding was officiated. By Adam Sandler. The man from Happy Gilmore, legally joined Taylor Swift and Travis Kelce, in matrimony. That is a real sentence. I checked it four times. And reportedly, there were no bridesmaids and no groomsmen. Her brother was Man of Honor. His brother was best man. Which is, honestly, kind of lovely. I'm not crying. You're crying."),
    ("billboard", "judge",
     "And then, outside, this. Pause. Look at that. They lit up the billboards around Madison Square Garden, in purple, reading, Just Married. For the entire city to see. Because when you are Taylor Swift, you do not simply text people that you got married. You inform Manhattan. Directly. By billboard."),
    ("parasocial", "smile",
     "Okay. Real talk, for one second. Why did millions of us, who have never met either of these people, care this much? Because that is just the deal now. A lot of us grew up with the music, we followed the whole story for years, and at some point it started to feel like someone we actually know was getting married. That feeling has a name. It's parasocial. It's mostly harmless. Mostly. Just, maybe, gently remember, that they do not know that we exist. And that is, probably, healthy."),
    ("outro", "smile",
     "So. Congratulations to Taylor and Travis. Genuinely. We were not invited. We watched anyway. And somehow, that also felt a little like love. This has been the Pip Report. I'm Pip. Now go outside. The billboards are very, very bright out there today."),
]


def draw_scene(d, img, kind, expr, t, dur):
    logo_bug(d)
    if kind == "intro":
        T(d, (960, 200), "THE PIP REPORT", 74, fill=hx(PURPLE), anchor="mm", stroke=5)
        T(d, (960, 285), "special: a stranger got married and we all watched", 30, fill=INK, anchor="mm", reg=True)
        pip(d, 960, 760, "desk", expr, 0.92, t)
        desk(d, top=690)
        chyron(d, "LIVE", "Taylor Swift & Travis Kelce: married", PURPLE)
    elif kind == "facts":
        facts_screen(d, t)
        pip(d, 1500, 740, "present", expr, 0.82, t)
        chyron(d, "RECAP", "July 3 · Madison Square Garden", PINK)
    elif kind == "guests":
        T(d, (960, 210), "the guest list (reportedly)", 46, fill=hx(PURPLE), anchor="mm", stroke=3)
        guest_grid(d, t)
        pip(d, 1700, 790, "present", expr, 0.5, t)
        chyron(d, "SUBCULTURE", "12% of Hollywood, one building", "#7FB069")
    elif kind == "sandler":
        screen(d, (110, 165, 1150, 720), "WAIT.", YELLOW)
        T(d, (630, 360), "officiant:", 44, fill=(200, 200, 210), anchor="mm", reg=True)
        T(d, (630, 460), "ADAM SANDLER", 74, fill=hx(YELLOW), anchor="mm")
        T(d, (630, 560), "(yes. that one.)", 34, fill=(210, 210, 220), anchor="mm", reg=True)
        pip(d, 1500, 740, "present", expr, 0.82, t)
        chyron(d, "BREAKING", "Adam Sandler, wedding officiant", YELLOW)
    elif kind == "billboard":
        billboard_clip(d, t, paused=(t > 1.4))
        pip(d, 1650, 728, "present", expr, 0.5, t)
        chyron(d, "RECEIPTS", "how to announce a wedding to a city", RED)
    elif kind == "parasocial":
        img.paste(v.grad("#2A2140", "#3E2A52").resize((W, H)))
        d2 = ImageDraw.Draw(img, "RGBA")
        logo_bug(d2)
        T(d2, (960, 250), "why did WE care?", 68, fill=(240, 235, 248), anchor="mm", stroke=4, sfill=(20, 15, 25))
        lines = ["you grew up with the music.", "you followed it for years.",
                 "it felt like someone you know.", "  -> that's parasocial. it's ok.",
                 "  (they don't know we exist. also ok.)"]
        cols = [(230, 225, 240)] * 3 + [hx(TEAL), (190, 185, 205)]
        for i, ln in enumerate(lines):
            if t < 0.6 + i * 0.7:
                continue
            T(d2, (500, 380 + i * 84), ln, 40, fill=cols[i], anchor="lm", reg=(i >= 3))
        pip(d2, 1660, 1000, "think", expr, 0.5, t)
        chyron(d2, "THE TAKE", "it's mostly harmless. mostly.", PURPLE)
        return
    elif kind == "outro":
        T(d, (960, 210), "congrats, you two.", 78, fill=hx(PURPLE), anchor="mm", stroke=5)
        T(d, (960, 300), "(we were not invited. we watched anyway.)", 36, fill=INK, anchor="mm", reg=True)
        pip(d, 960, 760, "desk", expr, 0.92, t)
        desk(d, top=690)
        chyron(d, "THE PIP REPORT", "new episode every week", PURPLE)


def render_segment(idx, kind, expr, cap, dur, wav):
    nf = max(int(dur * FPS_R) + 1, 4)
    mp4 = os.path.join(OUT, f"seg{idx:03d}.mp4")
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS_R), "-i", "-", "-i", wav,
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS_O),
         "-c:a", "aac", "-b:a", "160k", "-t", f"{dur:.3f}", mp4],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for fi in range(nf):
        t = fi / FPS_R
        img, d = pr.studio_bg(idx + 5, "#F4E9FF", "#FFF6EC")
        draw_scene(d, img, kind, expr, t, dur)
        d2 = ImageDraw.Draw(img, "RGBA")
        pr.caption(d2, cap)
        proc.stdin.write(img.resize((W, H), Image.LANCZOS).tobytes())
    proc.stdin.close(); proc.wait()
    return mp4


def main():
    seg_files, durations = [], []
    for i, (kind, expr, narr) in enumerate(SCENES):
        wav = os.path.join(OUT, f"seg{i:03d}.wav"); done = os.path.join(OUT, f"seg{i:03d}.done")
        if os.path.exists(done):
            durations.append(len(v.read_wav(wav)) / SR); seg_files.append(os.path.join(OUT, f"seg{i:03d}.mp4")); continue
        a = v.tts(narr, speed=1.0); a = np.concatenate([a, np.zeros(int(0.6 * SR))])
        v.write_wav(wav, a); dur = len(a) / SR; durations.append(dur)
        render_segment(i, kind, expr, narr, dur, wav); open(done, "w").close()
        print(f"[{i+1}/{len(SCENES)}] {kind} {dur:.1f}s", flush=True)
    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{os.path.abspath(p)}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined], check=True, capture_output=True)
    total = sum(durations); print(f"total {total:.1f}s", flush=True)
    v.write_wav(os.path.join(OUT, "bed.wav"), v.music_bed(total))
    final = os.path.join(OUT, "pip_report_taylor_wedding.mp4")
    subprocess.run(["ffmpeg", "-y", "-i", joined, "-i", os.path.join(OUT, "bed.wav"), "-filter_complex",
        "[1:a]volume=0.11[m];[0:a]volume=1.35[vv];[vv][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final], check=True, capture_output=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
