#!/usr/bin/env python3
"""Frame-by-frame lip-synced animation test of the avatar rig.

No AI video generation — every frame is drawn from the vector rig. Lip-sync is
driven off the real audio amplitude; blinks, brow-pops and a head bob are
procedural. Encoded with the voice track via ffmpeg.
"""
import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "esatian_build"))

import build_avatar as av
import build_vunderra as vd

av.SS = 2  # lighter supersample for animation speed
OUT = os.path.dirname(os.path.abspath(__file__))
SR = vd.SR
FPS = 30
W = H = 720

LINE = ("hey. it's me, but a cartoon now. and yeah, i kept the braces. "
        "this whole thing is drawn by hand, frame by frame. no A.I. video, anywhere. "
        "every single frame. pretty smooth, right?")


def bg_image():
    top = np.array([44, 48, 74], float); bot = np.array([26, 28, 46], float)
    col = np.linspace(top, bot, H).astype(np.uint8)
    img = Image.fromarray(np.repeat(col[:, None, :], W, axis=1), "RGB").convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    # soft spotlight behind the head
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W / 2 - 240, 40, W / 2 + 240, 560], fill=(120, 130, 200, 60))
    from PIL import ImageFilter
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))
    return img


def smooth(x, k=3):
    if k <= 1:
        return x
    ker = np.ones(k) / k
    return np.convolve(x, ker, mode="same")


def main():
    # 1) voice
    voice = vd.tts(LINE, voice="am_michael", speed=1.0)
    voice = np.concatenate([np.zeros(int(0.25 * SR)), voice, np.zeros(int(0.5 * SR))])
    wav = os.path.join(OUT, "anim_voice.wav")
    vd.write_wav(wav, voice)
    dur = len(voice) / SR
    nframes = int(dur * FPS)

    # 2) amplitude envelope per frame -> lip-sync
    amp = np.zeros(nframes)
    win = int(SR / FPS)
    for f in range(nframes):
        s0 = f * win
        seg = voice[s0:s0 + win]
        amp[f] = np.sqrt((seg ** 2).mean()) if len(seg) else 0.0
    amp = amp / (amp.max() + 1e-6)
    amp = smooth(amp, 3)

    # 3) blink schedule
    blink_frames = set()
    t = 1.1
    rng = np.random.RandomState(3)
    while t < dur - 0.3:
        bf = int(t * FPS)
        for k, ov in enumerate([0.7, 0.2, 0.05, 0.3, 0.75]):
            blink_frames.add((bf + k, ov))
        t += rng.uniform(2.0, 3.4)
    blink_map = {}
    for (fr, ov) in blink_frames:
        blink_map[fr] = min(blink_map.get(fr, 1.0), ov)

    bg = bg_image()
    font = ImageFont.truetype(av.FONT, 22)

    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
         "-t", f"{dur:.3f}", os.path.join(OUT, "avatar_anim_test.mp4")],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f in range(nframes):
        tt = f / FPS
        a = amp[f]
        # mouth from amplitude
        if a < 0.10:
            mouth = "neutral"
        elif a < 0.28:
            mouth = "talk1"
        elif a < 0.5:
            mouth = "talk2"
        else:
            mouth = "grin"
        # eye open (blink)
        eye_open = blink_map.get(f, 1.0)
        # brow pop on loud syllables
        brow_y = -7 * max(0, (a - 0.45) / 0.55) - (2 if a > 0.2 else 0)
        # head life
        tilt = 1.6 * math.sin(tt * 1.7) + 0.8 * math.sin(tt * 3.3)
        look_x = 0.35 * math.sin(tt * 0.8)
        bob = 5 * math.sin(tt * 2.1) + a * 4  # vertical bob, leans in on emphasis
        params = {"mouth": mouth, "eye_open": eye_open, "brow_y": brow_y,
                  "look_x": look_x, "head_tilt": tilt}

        frame = bg.copy()
        tile = av.avatar_tile(W, H, W / 2, 300 - bob, 1.12, params).resize((W, H), Image.LANCZOS)
        frame.alpha_composite(tile)
        d = ImageDraw.Draw(frame, "RGBA")
        d.text((W / 2, H - 26), "frame-by-frame · no AI video", font=font, fill=(210, 214, 235, 220), anchor="mm")
        proc.stdin.write(frame.convert("RGB").tobytes())
        if f % 30 == 0:
            print(f"frame {f}/{nframes}", flush=True)

    proc.stdin.close(); proc.wait()
    print("DONE:", os.path.join(OUT, "avatar_anim_test.mp4"), flush=True)


if __name__ == "__main__":
    main()
