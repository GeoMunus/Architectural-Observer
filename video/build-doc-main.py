#!/usr/bin/env python3
"""Assemble THE ESATIAN UNION documentary: scenes, render, score, mix."""
import os
import subprocess
import wave

import numpy as np
from PIL import ImageDraw

import build_doc as bd
import build_vunderra as vd

OUT = bd.OUT


def title_card(text, sub):
    base = bd.title_base()
    d = ImageDraw.Draw(base, "RGBA")
    d.text((bd.BW // 2, bd.BH // 2 - 80), text, font=bd.F(bd.SERIF_B, 132), fill=(232, 214, 178), anchor="mm")
    d.line([bd.BW // 2 - 460, bd.BH // 2 + 30, bd.BW // 2 + 460, bd.BH // 2 + 30], fill=(198, 164, 96), width=4)
    d.text((bd.BW // 2, bd.BH // 2 + 110), sub, font=bd.F(bd.SERIF, 52), fill=(200, 178, 142), anchor="mm")
    return base


def branches_card():
    base = bd.aged_base(6)
    d = ImageDraw.Draw(base, "RGBA")
    d.text((bd.BW // 2, 150), "THE THREE BRANCHES", font=bd.F(bd.SERIF_B, 76), fill=(224, 206, 170), anchor="mm")
    cols = [("THE GERIG", "enacts the union's laws"),
            ("THE SOTONIC BRANCH", "speaks for the nations"),
            ("THE MODELIC BRANCH", "governs the homeland")]
    for i, (nm, sub) in enumerate(cols):
        cx = bd.BW // 2 + (i - 1) * 780
        d.rectangle([cx - 320, 360, cx + 320, 1080], fill=(70, 60, 44), outline=(150, 120, 70), width=6)
        # a pillar
        d.rectangle([cx - 60, 460, cx + 60, 980], fill=(120, 104, 74))
        d.rectangle([cx - 90, 440, cx + 90, 480], fill=(150, 128, 88))
        d.rectangle([cx - 90, 960, cx + 90, 1000], fill=(150, 128, 88))
        d.text((cx, 1150), nm, font=bd.F(bd.SERIF_B, 46), fill=(226, 208, 172), anchor="mm")
        d.text((cx, 1210), sub, font=bd.F(bd.SERIF, 34), fill=(190, 168, 132), anchor="mm")
    return base


# Gerig portrait params
G = {
    "taketi": {"skin": "med", "hair": "brown", "hair_style": "short", "facial": "mustache",
               "attire": (44, 58, 44), "collar": (198, 164, 96), "brow": 2, "eyes": (70, 60, 44)},
    "khabora": {"skin": "tan", "hair": "black", "hair_style": "short", "facial": "full",
                "attire": (54, 46, 38), "brow": 5, "eyes": (60, 50, 40)},
    "dexter": {"skin": "pale", "hair": "blonde", "hair_style": "recede", "attire": (60, 48, 70),
               "collar": (170, 150, 90), "mouth": "slight", "eyes": (90, 100, 120)},
    "mila": {"skin": "pale", "hair": "auburn", "hair_style": "long", "attire": (72, 40, 60),
             "collar": (198, 164, 96), "crown": True, "mouth": "slight", "eyes": (96, 74, 52)},
    "sutlam": {"skin": "med", "hair": "black", "hair_style": "short", "facial": "mustache",
               "attire": (48, 44, 48), "brow": -3, "eyes": (58, 52, 46)},
    "lorvan": {"skin": "tan", "hair": "black", "hair_style": "short", "facial": "mustache",
               "attire": (46, 52, 60), "collar": (150, 150, 156), "brow": 3, "eyes": (66, 56, 44)},
}

# (kind, narration, lower_third)
SCENES = [
    ("title",
     "In the west of a troubled continent, a single idea took root: that many nations, divided by borders and by blood, might choose instead to be one. This is the story of how the Esatian Union was governed. Of the men and women who led it. And of the fragile machinery of power they built, to hold it together.",
     None),
    ("founding",
     "It began, as these things so often do, with hunger. In the year seventeen seventy-six, the poor of the crumbling Barthic Empire rose in rebellion. And when the fighting was over, they had not merely toppled a throne. They had, almost by accident, founded a country. The South Barths, the Barthstevs, and the Stelantins, bound together into a single state. Twelve years later, they took the name the world still knows them by. The Esatian Union.",
     ("The Founding", "1776")),
    ("branches",
     "Power in the new union was divided, deliberately, so that no single hand might ever hold too much of it. At its center stood the Gerig, chosen by all the member nations, whose duty was to enact the union's laws. Beneath him, the Sotonic Branch spoke for the individual nations. And the Modelic Branch governed the provinces of the homeland, Barthia. Three branches. One uneasy balance.",
     ("The Structure of Power", "the three branches")),
    ("constitution",
     "Their constitution was short, and its demands were absolute. No nation of the union might wage war within its borders, nor beyond them. And none might permit tyranny. Tyranny, the document warned, was any rule that was cruel, or arbitrary, or unaccountable to the people. It was a promise. It would not always be kept.",
     ("The Constitution", "Article II")),
    ("portrait:taketi",
     "The first Gerig was a soldier, named Taketi Dagati. He had led the union's armies to victory, and now he was asked to lead its government. He is remembered, simply, as the one who held a new and fragile nation together, in the years when it might so easily have fallen apart.",
     ("Taketi Dagati", "First Gerig · 1776")),
    ("portrait:khabora",
     "Not all who followed him were remembered so fondly. Khabora Dagilidan was, by every account, a gifted man. A hunter. A craftsman. A leader who very nearly ushered in an age of invention. But history did not record him for any of these things. It recorded him for the crime that ended his rule: the murder, and the consumption, of his own wife. The union, it seemed, could elevate any man. It could not always redeem him.",
     ("Khabora Dagilidan", "Gerig · 1793")),
    ("portrait:dexter",
     "Others were remembered for stranger reasons entirely. In nineteen fifteen, Dexter Robins gifted the entire state of Lyance to his wife, as a birthday present, for the span of a single month. He attempted to make a dance of his own invention, the Wiggle, mandatory by law. Historians have judged him, generously, as harmless.",
     ("Dexter Robins", "Gerig · 1915")),
    ("portrait:mila",
     "But the union's most beloved leader wore no true crown, and yet was called a queen. Mila Lenking took power in nineteen seventy-five, and brought an end to the long and bitter First Esati-Quebec War. In an age that did not expect it of her, she governed with a strength that made her a symbol, for generations of women who came after. Esatia's only queen. She was mourned by an entire nation.",
     ("Mila Lenking", "\"Esatia's Only Queen\" · 1975")),
    ("amendment",
     "That war left a mark deeper than any single leader. Having entered it, and having lost, the union resolved that it would never make such a choice again. A new line was added to its constitution, in the plainest language its authors could find. The Gerig shall not declare war. It was an extraordinary thing, for any nation to promise. That its very power to wage war would be surrendered. Forever.",
     ("The Amendment", "never again")),
    ("portrait:sutlam",
     "And yet power, once created, is a dangerous thing to hold. In nineteen eighty-three, the Gerig Sutlam Arkas was assassinated. A bounty had been placed upon his life, and it was collected, coldly, and divided between the killer, and the man who had ordered it. They called him, afterward, the Target.",
     ("Sutlam Arkas", "\"The Target\" · 1983")),
    ("portrait:lorvan",
     "Which brings us, at last, to the present. In twenty twenty-three, as war came once more to the region, the union turned to Lorvan Madin. He led it to victory against the nation of Tadar, and to the liberation of two long-oppressed peoples. To many, he is a hero. History has not yet decided whether he will remain one.",
     ("Lorvan Madin", "Gerig · 2023 – present")),
    ("conclusion",
     "The Esatian Union endures. Eighteen nations. Fifty million souls. Held together, not by force, but by a fragile agreement, renewed by each generation: that it is better to be one, than to be many. It has been led by heroes, and by monsters. By queens, and by cannibals. And still, somehow, it holds. Perhaps that is the most that any government can ever hope to be. Not perfect. Only lasting.",
     ("The Esatian Union", "1776 – present")),
]


def build_base(kind):
    if kind == "title":
        return title_card("THE ESATIAN UNION", "A History of Government")
    if kind == "founding":
        return bd.map_base(seed=4)
    if kind == "branches":
        return branches_card()
    if kind in ("constitution",):
        return bd.document_base(seed=3)
    if kind == "amendment":
        return bd.document_base(seed=7, lines=4)
    if kind == "conclusion":
        return bd.title_base()
    if kind.startswith("portrait:"):
        key = kind.split(":")[1]
        return bd.framed_portrait(G[key], seed=hash(key) % 50)
    return bd.aged_base(1)


def kb_for(kind, i):
    if kind.startswith("portrait:"):
        return bd.kb_portrait_pushin()
    if kind in ("title", "conclusion"):
        return bd.kb_pan(w=bd.BW * 0.86, dx=(140 if i % 2 == 0 else -140), dy=40)
    if kind in ("constitution", "amendment"):
        return bd.kb_in(w0=bd.BW * 0.92, w1=bd.BW * 0.66)
    return bd.kb_pan(w=bd.BW * 0.84, dx=200 * (1 if i % 2 else -1), dy=-50)


def main():
    seg_files, durations = [], []
    for i, (kind, narr, lower) in enumerate(SCENES):
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        mp4 = os.path.join(OUT, f"seg{i:03d}.mp4")
        if os.path.exists(done):
            with wave.open(wav) as f:
                durations.append(f.getnframes() / f.getframerate())
            seg_files.append(mp4); continue
        v = vd.tts(narr, voice="am_michael", speed=0.92)
        v = np.concatenate([np.zeros(int(0.3 * bd.SR)), v, np.zeros(int(0.9 * bd.SR))])
        vd.write_wav(wav, v)
        with wave.open(wav) as f:
            dur = f.getnframes() / f.getframerate()
        durations.append(dur)
        base = build_base(kind)
        bd.render_scene(i, base, kb_for(kind, i), lower, dur, wav)
        open(done, "w").close()
        seg_files.append(mp4)
        print(f"[{i+1}/{len(SCENES)}] {kind} {dur:.1f}s", flush=True)

    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{os.path.abspath(p)}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined], check=True)
    total = sum(durations)
    print(f"total {total:.1f}s — composing score", flush=True)
    score = bd.compose_score(total)
    final = os.path.join(OUT, "the_esatian_union_documentary.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-i", score, "-filter_complex",
                    "[1:a]volume=0.14[m];[0:a]volume=1.35[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final], check=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
