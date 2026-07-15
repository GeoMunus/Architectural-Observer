#!/usr/bin/env python3
"""THE FALL OF THE UNION — sequel documentary (2028–2095).

Reuses the archival engine in build_doc.py. Covers the lore doc's future
timeline: Duzni Azno, Klugen Adagi, Kipa Kilophi's Imperial Party, the
assassination, the civil war and 2066 partition, and Andon Balexti's Kingsmen.
All narration is original prose over the user's fictional universe.
"""
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw

import build_doc as bd
import build_vunderra as vd

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "doc2_out")
os.makedirs(OUT, exist_ok=True)
bd.OUT = OUT  # scene renders + score land here


def title_card(text, sub):
    base = bd.title_base()
    d = ImageDraw.Draw(base, "RGBA")
    d.text((bd.BW // 2, bd.BH // 2 - 80), text, font=bd.F(bd.SERIF_B, 118), fill=(226, 204, 168), anchor="mm")
    d.line([bd.BW // 2 - 500, bd.BH // 2 + 30, bd.BW // 2 + 500, bd.BH // 2 + 30], fill=(170, 120, 70), width=4)
    d.text((bd.BW // 2, bd.BH // 2 + 110), sub, font=bd.F(bd.SERIF, 50), fill=(196, 170, 134), anchor="mm")
    return base


def partition_card():
    """The 2066 partition: the union's map carved into three occupation zones."""
    base = bd.map_base(seed=11).convert("RGBA")
    d = ImageDraw.Draw(base, "RGBA")
    W, H = bd.BW, bd.BH
    # three zones as translucent overlays with jagged frontiers
    zones = [
        ("ONTANA", (120, 60, 50, 92), [(0, 0), (W * 0.44, 0), (W * 0.40, H * 0.35),
                                        (W * 0.46, H * 0.66), (W * 0.38, H), (0, H)]),
        ("DYSKONTURE", (70, 74, 84, 96), [(W * 0.44, 0), (W, 0), (W, H * 0.52),
                                           (W * 0.62, H * 0.56), (W * 0.52, H * 0.38), (W * 0.40, H * 0.35)]),
        ("QUEBEC", (60, 76, 100, 92), [(W * 0.46, H * 0.66), (W * 0.52, H * 0.38), (W * 0.62, H * 0.56),
                                        (W, H * 0.52), (W, H), (W * 0.38, H)]),
    ]
    ov = Image.new("RGBA", base.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for (_, col, pts) in zones:
        od.polygon(pts, fill=col)
    base.alpha_composite(ov)
    d = ImageDraw.Draw(base, "RGBA")
    # frontiers
    d.line([(W * 0.44, 0), (W * 0.40, H * 0.35), (W * 0.46, H * 0.66), (W * 0.38, H)],
           fill=(40, 30, 24, 220), width=8)
    d.line([(W * 0.40, H * 0.35), (W * 0.52, H * 0.38), (W * 0.62, H * 0.56), (W, H * 0.52)],
           fill=(40, 30, 24, 220), width=8)
    labels = [("ONTANA", W * 0.20, H * 0.42), ("DYSKONTURE", W * 0.72, H * 0.24),
              ("QUEBEC", W * 0.72, H * 0.76)]
    for (nm, x, y) in labels:
        d.text((x, y), nm, font=bd.F(bd.SERIF_B, 64), fill=(232, 214, 178), anchor="mm",
               stroke_width=3, stroke_fill=(30, 22, 16))
    d.text((W // 2, 140), "THE PARTITION · 2066", font=bd.F(bd.SERIF_B, 66),
           fill=(226, 206, 170), anchor="mm", stroke_width=3, stroke_fill=(30, 22, 16))
    return base.convert("RGB")  # grade_frame expects RGB; RGBA wraps rows into tiled garbage


# new leader portraits (same vocabulary as the first film's G dict)
G2 = {
    "duzni": {"skin": "tan", "hair": "brown", "hair_style": "short",
              "attire": (78, 62, 34), "collar": (210, 176, 92), "brow": 1,
              "mouth": "slight", "eyes": (84, 66, 44)},
    "klugen": {"skin": "med", "hair": "black", "hair_style": "short", "facial": "mustache",
               "attire": (58, 54, 48), "collar": (140, 130, 110), "brow": 2, "eyes": (60, 52, 42)},
    "kipa": {"skin": "pale", "hair": "black", "hair_style": "recede",
             "attire": (34, 28, 32), "collar": (128, 44, 40), "brow": 6, "eyes": (52, 46, 48)},
    "andon": {"skin": "tan", "hair": "brown", "hair_style": "short", "facial": "full",
              "attire": (52, 48, 40), "collar": (110, 96, 70), "brow": 4, "eyes": (62, 52, 40)},
}

# (kind, narration, lower_third)
SCENES = [
    ("title",
     "Every union is a promise. And every promise, in the end, is tested. In the first century of its life, the Esatian Union survived monsters, and wars, and its own worst leaders. This is the story of the century it did not survive. Of how the great experiment of seventeen seventy-six was brought, at last, to its knees.",
     None),
    ("prologue",
     "By the twenty-first century, the union stood at the height of its power. Eighteen nations. Fifty million people. Victorious in war, and bound by a constitution that forbade tyranny itself. It seemed, to those who lived in it, that it might last forever. Nothing lasts forever.",
     ("The Union at its Height", "2024")),
    ("portrait:duzni",
     "The unraveling began quietly, at the ballot box. In twenty twenty-eight, the union elected Duzni Azno. A celebrity. A businessman of enormous wealth, and enormous certainty. He championed the military in a nation sworn against war, and spoke of the homeless not with pity, but with contempt. His years in office left the union richer, louder, and more divided than it had ever been.",
     ("Duzni Azno", "Gerig · 2028")),
    ("portrait:klugen",
     "What followed felt, for a moment, like recovery. Klugen Adagi, a leader of the old Worker Party, was swept into office in twenty thirty-three on a single promise: order. And he kept it. The unrest cooled. The union steadied. History would remember him gently, as the last calm before the storm.",
     ("Klugen Adagi", "Gerig · 2033")),
    ("portrait:kipa",
     "The storm had a name. Kipa Kilophi came to power in twenty thirty-eight, and within a year, the old parties were gone. In their place stood a single movement, of his own invention: the Imperial Party. The union that had once written the absence of tyranny into law, now watched a Gerig gather the whole of its power into one hand.",
     ("Kipa Kilophi", "Gerig · 2038")),
    ("decree",
     "What came next followed the oldest pattern in the world. The wars the constitution forbade were declared anyway, against Dyskonture, and against Ontana. The newspapers that objected fell silent, one by one. Dissent became treason. And treason became an industry. Kipa founded a company for the purpose, a private bureau whose only trade was the hunting of his enemies.",
     ("The Imperial Party", "the amendment, broken")),
    ("assassination",
     "It was that same bureau that ended him. The hunters of treason turned, at last, upon the man who had built them. Kipa Kilophi was assassinated by his own creation. And the union he had hollowed out did not mourn him. It simply, and immediately, began to tear itself apart.",
     ("The Assassination", "the creation turns")),
    ("partition",
     "The civil war that followed lasted a generation. And when it ended, in twenty sixty-six, there was no union left to save. The old enemies it had once defeated divided the land between them. Ontana in the west. Dyskonture in the east. Quebec in the south. Two hundred and ninety years after the poverty rebellion, the Esatian Union ceased to exist.",
     ("The Partition", "2066")),
    ("portrait:andon",
     "What remained was not a nation, but a memory, and men willing to fight for it. From twenty sixty-six until the end of the century, Andon Balexti led the Balextitek Kingsmen, a brotherhood sworn to the union that was. For twenty-nine years they kept its flame alive in the occupied lands. History does not yet know whether to call them the last soldiers of the old union. Or the first of a new one.",
     ("Andon Balexti", "The Balextitek Kingsmen · 2066 – 2095")),
    ("conclusion",
     "The first film of this history ended with a hope: that a government need not be perfect. Only lasting. The Esatian Union lasted two hundred and ninety years. It outlived its founders, its monsters, and very nearly its enemies. In the end, it was not conquered from without. It was surrendered from within, one small silence at a time. Remember it. Not because it fell. But because, for two hundred and ninety years, it held.",
     ("The Esatian Union", "1776 – 2066")),
]


def build_base(kind):
    if kind == "title":
        return title_card("THE FALL OF THE UNION", "Esatia · 2028 – 2095")
    if kind == "prologue":
        return bd.map_base(seed=4)
    if kind == "decree":
        return bd.document_base(seed=5, lines=5)
    if kind == "assassination":
        return bd.aged_base(13)
    if kind == "partition":
        return partition_card()
    if kind == "conclusion":
        return bd.title_base()
    if kind.startswith("portrait:"):
        key = kind.split(":")[1]
        return bd.framed_portrait(G2[key], seed=hash(key) % 50)
    return bd.aged_base(2)


def kb_for(kind, i):
    if kind.startswith("portrait:"):
        return bd.kb_portrait_pushin()
    if kind in ("title", "conclusion"):
        return bd.kb_pan(w=bd.BW * 0.86, dx=(140 if i % 2 == 0 else -140), dy=40)
    if kind in ("decree",):
        return bd.kb_in(w0=bd.BW * 0.92, w1=bd.BW * 0.66)
    if kind == "partition":
        return bd.kb_in(w0=bd.BW, w1=bd.BW * 0.78)
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
    final = os.path.join(OUT, "the_fall_of_the_union.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-i", score, "-filter_complex",
                    "[1:a]volume=0.14[m];[0:a]volume=1.35[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final], check=True)
    print("FINAL:", final, flush=True)


if __name__ == "__main__":
    main()
