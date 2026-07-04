#!/usr/bin/env python3
"""Build 'history of the esatian union, i guess' — a bill wurtz style video.

Pipeline: piper TTS per segment -> PIL card renders -> ffmpeg zoompan segments
-> concat -> numpy-generated music bed -> final mix.
"""
import json
import math
import os
import random
import struct
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
VOICE = os.path.join(BASE, "..", "ttsvoice", "ryan.onnx")
OUT = os.path.join(BASE, "out")
os.makedirs(OUT, exist_ok=True)

SR = 22050
W, H = 1920, 1080
FPS = 30

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_OBL = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

COLORS = ["#2EC4B6", "#FF6B6B", "#9B5DE5", "#FFB703", "#F15BB5",
          "#00BBF9", "#06D6A0", "#FB8500", "#4361EE", "#EF476F"]
JINGLE_BG = "#22223B"
DARK_TEXT_BGS = {"#FFB703"}  # bright yellow gets dark text

# (kind, tts_text, card_text)  kind: n=normal, j=jingle, e=endcard(no VO)
SEGS = [
    ("n", "hi.", "history of the esatian union, i guess"),
    ("n", "you're in the esatian region.", "the esatian region"),
    ("n", "it's 1375, and nothing here has a flag yet.", "1375: no flags yet"),
    ("n", "these guys called Dyskonturahulaven and Ontanaven colonize a huge amount of land, which sounds impressive,", "dyskonturahulaven & ontanaven"),
    ("n", "until they collapse, 58 years later. bye.", "collapsed. bye."),
    ("n", "it's 1487. a tribe called the Esat starts a colony on the west lyantic peninsula,", "1487: the esat tribe"),
    ("n", "and immediately brands itself as an EMPIRE. confidence. love that.", "the esatic empire"),
    ("n", "meanwhile the barths beat up a place called birgelzt and also become an empire, because apparently that's just what you did back then.", "barthic empire (also an empire)"),
    ("j", "you could make an empire, out of this.", "you could make an empire out of this"),
    ("n", "1678: the barthic empire eats the esatic empire. not violently. administratively.", "1678: eaten (administratively)"),
    ("n", "1703: the british and the french discover the new world, which was already there.", "1703: \"discovered\""),
    ("n", "the north says, we'll be british. and the south says, we'll also be british. bold strategy.", "everyone: \"we'll be british\""),
    ("n", "the british and the barths set up a joint colony in india to negotiate resources, which is a nice way of saying something way worse.", "a \"joint colony\""),
    ("n", "1735: britain declares war on congrave.", "1735: war with congrave"),
    ("n", "the esatian colonies look at their maintenance budget, see that it's zero, and revolt.", "maintenance budget: zero"),
    ("n", "the barthic empire has a civil war about slavery, then declares war on britain,", "civil war + regular war"),
    ("n", "and the king of britain does not handle it well. at all. rest in peace, king thomas.", "rip king thomas"),
    ("n", "1752: the barthic empire snaps in half. north barths. south barths. classic.", "1752: snap."),
    ("n", "1776: the poor people of the barthic empire have had ENOUGH, do a whole poverty rebellion, and accidentally invent a country. the esatic union.", "1776: the esatic union"),
    ("n", "south barths, barthstevs, stelantins. everybody in the pool.", "everybody in the pool"),
    ("j", "you could make a union, out of this.", "you could make a union out of this"),
    ("n", "1788: they rename themselves the ESATIAN union, because that's what the british had been calling them anyway. and honestly? the branding was better.", "esatian union (rebrand)"),
    ("n", "now watch this.", "now watch this"),
    ("n", "1803: north barthia joins.", "+ north barthia"),
    ("n", "1845: abburan joins, and renames itself abburania. very cute.", "+ abburania (cute)"),
    ("n", "1900: ontana declares war, because the union WOULDN'T declare war on dyskonture.", "1900: ontana attacks"),
    ("n", "that's right. they got attacked, for being too peaceful. incredible.", "attacked for being too peaceful"),
    ("n", "1902: lyance BUYS an entire colony from the british called new warmth, and renames it nuswarm. which is the same thing, but faster.", "new warmth -> nuswarm"),
    ("n", "1904: ollia, stevia, new georgia and lyance all join at once, to fight ontana.", "+ 4 more nations"),
    ("n", "1911: adazons, niagara, new haven. also in.", "+ 3 more nations"),
    ("n", "this union is a black hole, and countries are the light.", "union = black hole"),
    ("n", "1946: ontana is finally defeated. it took 46 years. nobody talks about that.", "1946: ontana defeated (46 years)"),
    ("n", "1955: gallanter and galikh, two provinces that supported pacifism, escape ontana and join the union.", "+ gallanter + galikh"),
    ("n", "the pacifists won a war. think about it. don't think about it too hard.", "pacifists: 1 · war: 0"),
    ("n", "quick intermission. how does this thing even work?", "intermission"),
    ("n", "there's the GERIG, who represents everyone, and enacts the bills.", "the gerig"),
    ("n", "there's the SOTONIC branch, which makes national bills. and the MODELIC branch, which is just for barthia. because barthia is the homeland, and gets special stuff.", "sotonic branch + modelic branch"),
    ("n", "the constitution says: no wars inside you, no wars outside you, and absolutely no tyranny.", "absolutely no tyranny"),
    ("n", "tyranny is defined in the document. they wrote it down. it's article two.", "see: article II"),
    ("j", "constitutional.", "constitutional"),
    ("n", "some gerig highlights.", "gerig highlights"),
    ("n", "khabora dagilidan. amazing hunter. skilled craftsman. ate his wife. moving on.", "khabora: hunter · craftsman · cannibal"),
    ("n", "dexter robins gave the entire state of lyance to HIS wife, for a month, as a birthday present.", "dexter: gifted a whole state"),
    ("n", "and tried to make a national dance called the wiggle, legally mandatory. historians describe him as, ultimately harmless.", "the wiggle (mandatory)"),
    ("n", "sutlam arkas had a two hundred thousand green bounty on his head, and was assassinated by a hitman, who split the money with his boss. fifty fifty. fair is fair.", "sutlam \"the target\""),
    ("n", "and mila lenking, esatia's only queen, ended a whole war, and became a symbol of feminism. legend.", "mila lenking. legend."),
    ("n", "1967: a women's rights movement reaches quebec. and the president of quebec responds by killing hundreds of protestors. many of them, ethnic esatians.", "1967: quebec. it's bad."),
    ("n", "the union steps in. the union loses. quebec takes a whole province.", "esatia loses"),
    ("n", "esatia surrenders, and adds a constitutional amendment that says: we are literally never declaring war again.", "never declaring war again"),
    ("j", "never declaring war, agaaain.", "never declaring war again"),
    ("n", "2020: quebec comes back for round two, over a territorial dispute.", "2020: quebec, round 2"),
    ("n", "this time, esatia WINS. and gains babalra.", "esatia wins (+ babalra)"),
    ("n", "the amendment said they can't DECLARE wars. it said nothing, about winning them.", "*declaring. winning is fine."),
    ("n", "2021: adazonia holds a referendum, and nis adazon becomes independent, for approximately one afternoon, before joining the union.", "+ nis adazon (independent for 1 afternoon)"),
    ("n", "2022: dyskonture joins the union.", "+ dyskonture"),
    ("n", "2023: dyskonture is kicked OUT of the union, for corruption, and violence.", "- dyskonture"),
    ("n", "shortest membership in history. we hardly knew you. we did know you, actually. that was the problem.", "we knew you too well"),
    ("n", "also 2023: tadar declares war on the union, over religion.", "2023: tadar attacks"),
    ("n", "and stelan and the barthstevs fuse into one nation, called stelkizade. like it's an anime.", "stelkizade (fusion)"),
    ("n", "2024: tadar loses. hard. most of their territory goes to esatia, and a european nation called hisheda.", "2024: tadar loses, hard"),
    ("n", "atharas and ijalia are liberated.", "atharas + ijalia: liberated"),
    ("n", "the gerig who did it, lorvan madin, is considered a hero. and he's still in charge, right now.", "lorvan madin: hero"),
    ("n", "so, that's the esatian union.", "so that's the esatian union"),
    ("n", "eighteen nations. fifty million people. three branches. two religions. one cannibal.", "18 nations · 50m people · 1 cannibal"),
    ("n", "and a constitution that technically prevents war. and statistically, does not.", "war-proof* (*not really)"),
    ("j", "that's the esatian union, i guess.", "that's the esatian union, i guess"),
    ("e", "", "the esatian union, i guess"),
]

END_SUB = "please subscribe or g minus eats the fish. still. that threat is ongoing."


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def tts(text, path, length_scale):
    subprocess.run(
        ["piper", "-m", VOICE, "-f", path, "--length-scale", str(length_scale)],
        input=text.encode(), check=True, capture_output=True)


def read_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(name, octave):
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave - 4) - 9) / 12)


def ep_note(f, dur, vol=1.0):
    """Electric-piano-ish pluck."""
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-2.2 * t)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)
         + 0.12 * np.sin(2 * np.pi * 3 * f * t))
    return vol * env * x


def pad_chord(freqs, dur, vol=1.0):
    """Lush slow-attack pad."""
    t = np.arange(int(dur * SR)) / SR
    a = min(0.6, dur / 3)
    env = np.minimum(t / a, 1.0) * np.exp(-0.25 * t)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (0.998, 1.0, 1.003):
            x += np.sin(2 * np.pi * f * det * t + random.random())
    return vol * env * x / (len(freqs) * 3)


CHORDS = [  # Fmaj7, Am7, Dm7, G7 — bass note + chord tones
    (("F", 2), [("F", 3), ("A", 3), ("C", 4), ("E", 4)]),
    (("A", 2), [("A", 3), ("C", 4), ("E", 4), ("G", 4)]),
    (("D", 2), [("D", 3), ("F", 3), ("A", 3), ("C", 4)]),
    (("G", 2), [("G", 3), ("B", 3), ("D", 4), ("F", 4)]),
]


def music_bed(total_dur):
    bar = 2.4  # seconds per chord
    n = int(total_dur * SR) + SR
    out = np.zeros(n)
    t0, i = 0.0, 0
    while t0 < total_dur:
        bass, chord = CHORDS[i % 4]
        s = int(t0 * SR)
        seg = ep_note(freq(*bass) , bar, 0.5)
        out[s:s + len(seg)] += seg[:max(0, min(len(seg), n - s))]
        # comp hits on beat 1 and the and-of-2
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


def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        test = (cur + " " + w_).strip()
        if draw.textlength(test, font=font) <= maxw:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def render_card(idx, kind, card_text, caption):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    if kind == "j":
        img.paste(Image.new("RGB", (W, H), hex2rgb(JINGLE_BG)))
        d = ImageDraw.Draw(img)
        rnd = random.Random(idx)
        for _ in range(90):  # sparkle field
            x, y = rnd.randint(0, W), rnd.randint(0, H)
            r = rnd.choice([1, 1, 2, 2, 3])
            c = rnd.choice([(255, 255, 255), (255, 230, 150), (180, 220, 255)])
            d.ellipse([x - r, y - r, x + r, y + r], fill=c)
            if r >= 2:
                d.line([x - 3 * r, y, x + 3 * r, y], fill=c, width=1)
                d.line([x, y - 3 * r, x, y + 3 * r], fill=c, width=1)
        fg, font_path = (255, 255, 255), FONT_OBL
        card_text = "♪  " + card_text + "  ♪"
    else:
        bg = COLORS[idx % len(COLORS)]
        img.paste(Image.new("RGB", (W, H), hex2rgb(bg)))
        d = ImageDraw.Draw(img)
        fg = (40, 40, 40) if bg in DARK_TEXT_BGS else (255, 255, 255)
        font_path = FONT_BOLD

    size = 130
    while size > 40:
        font = ImageFont.truetype(font_path, size)
        lines = wrap(d, card_text, font, 1680)
        lh = int(size * 1.18)
        if len(lines) <= 3 and len(lines) * lh < 640:
            break
        size -= 8
    total_h = len(lines) * lh
    y = (H - total_h) // 2 - 60
    stroke = (0, 0, 0) if fg == (255, 255, 255) else None
    for ln in lines:
        x = (W - d.textlength(ln, font=font)) // 2
        d.text((x, y), ln, font=font, fill=fg,
               stroke_width=4 if stroke else 0, stroke_fill=stroke)
        y += lh

    if caption:
        cf = ImageFont.truetype(FONT_BOLD, 40)
        clines = wrap(d, caption.lower(), cf, 1600)
        cy = 1005 - len(clines) * 52  # keep clear of zoom cropping
        for ln in clines:
            x = (W - d.textlength(ln, font=cf)) // 2
            d.text((x, cy), ln, font=cf, fill=(255, 255, 255),
                   stroke_width=3, stroke_fill=(0, 0, 0))
            cy += 52
    if kind == "e":
        cf = ImageFont.truetype(FONT_BOLD, 38)
        clines = wrap(d, END_SUB, cf, 1500)
        cy = H // 2 + 160
        for ln in clines:
            x = (W - d.textlength(ln, font=cf)) // 2
            d.text((x, cy), ln, font=cf, fill=(230, 230, 230),
                   stroke_width=3, stroke_fill=(0, 0, 0))
            cy += 50
    p = os.path.join(OUT, f"card{idx:03d}.png")
    img.save(p)
    return p


def echoize(src, dst):
    run(["ffmpeg", "-y", "-i", src,
         "-af", "aecho=0.8:0.55:70|150:0.35|0.22,volume=1.1",
         "-ar", str(SR), "-ac", "1", dst])


def main():
    random.seed(7)
    seg_files = []
    durations = []
    for i, (kind, text, card) in enumerate(SEGS):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        if kind == "e":
            audio = pad_chord([freq(*n) for n in JCHORD], 4.0, 0.5)
            write_wav(wav, audio * 0.6)
        elif kind == "j":
            raw = os.path.join(OUT, f"raw{i:03d}.wav")
            tts(text, raw, 1.55)
            ech = os.path.join(OUT, f"ech{i:03d}.wav")
            echoize(raw, ech)
            v = read_wav(ech)
            dur = len(v) / SR + 0.8
            pad = pad_chord([freq(*n) for n in JCHORD], dur, 0.9)
            mix = np.zeros(int(dur * SR))
            mix[:len(pad)] += pad * 0.45
            ofs = int(0.25 * SR)
            mix[ofs:ofs + len(v)] += v
            write_wav(wav, mix)
        else:
            raw = os.path.join(OUT, f"raw{i:03d}.wav")
            tts(text, raw, 0.87)
            v = read_wav(raw)
            out_a = np.concatenate([v, np.zeros(int(0.18 * SR))])
            if i == 0 and len(out_a) < int(2.8 * SR):  # hold the title card
                out_a = np.concatenate([out_a, np.zeros(int(2.8 * SR) - len(out_a))])
            write_wav(wav, out_a)
        d = len(read_wav(wav)) / SR
        durations.append(d)
        card_p = render_card(i, kind, card, text if kind == "n" else "")
        frames = max(int(d * FPS) + 1, 8)
        mp4 = os.path.join(OUT, f"seg{i:03d}.mp4")
        zdir = "min(1.08,1+0.0003*on)" if i % 2 == 0 else "max(1.0,1.08-0.0003*on)"
        run(["ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-i", card_p,
             "-i", wav,
             "-filter_complex",
             f"[0:v]scale=2880:1620,zoompan=z='{zdir}':d={frames}:x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':s=1920x1080:fps={FPS}[v]",
             "-map", "[v]", "-map", "1:a",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
             "-t", f"{d:.3f}", mp4])
        seg_files.append(mp4)
        print(f"[{i + 1}/{len(SEGS)}] {kind} {d:.2f}s  {card[:40]}")

    concat_list = os.path.join(OUT, "list.txt")
    with open(concat_list, "w") as f:
        for p in seg_files:
            f.write(f"file '{p}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
         "-c", "copy", joined])

    total = sum(durations)
    print(f"total duration: {total:.1f}s")
    bed = music_bed(total)
    bed_wav = os.path.join(OUT, "bed.wav")
    write_wav(bed_wav, bed)

    final = os.path.join(OUT, "history_of_the_esatian_union_i_guess.mp4")
    run(["ffmpeg", "-y", "-i", joined, "-i", bed_wav,
         "-filter_complex",
         "[1:a]volume=0.16[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[a]",
         "-map", "0:v", "-map", "[a]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final])
    print("FINAL:", final)


if __name__ == "__main__":
    main()
