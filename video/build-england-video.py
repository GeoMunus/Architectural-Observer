#!/usr/bin/env python3
"""history of england, i guess — bill wurtz style, with UPGRADED jingles.

Reuses the visual system from build_video2. New jingle engine: a real jazzy
bed (Rhodes + upright bass + soft drums) with the melody hook carried on a
GM "Choir Aahs" patch (so it sounds sung), rendered via fluidsynth, with the
spoken line layered dreamily on top.
"""
import os
import subprocess
import wave

import numpy as np
import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack

import build_video2 as bw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eng_out")
os.makedirs(OUT, exist_ok=True)
bw.OUT = OUT
SR = bw.SR
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
TPB = 480

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7,
        "G#": 8, "A": 9, "A#": 10, "B": 11}


def nn(name, octv):
    return NOTE[name] + 12 * (octv + 1)


# jazzy 7th voicings (mid), root for bass
VOICING = {
    "Fmaj7": (nn("F", 2), [nn("A", 3), nn("C", 4), nn("E", 4), nn("F", 4)]),
    "Em7":   (nn("E", 2), [nn("G", 3), nn("B", 3), nn("D", 4), nn("E", 4)]),
    "Am7":   (nn("A", 2), [nn("C", 4), nn("E", 4), nn("G", 4), nn("A", 4)]),
    "Dm7":   (nn("D", 2), [nn("F", 3), nn("A", 3), nn("C", 4), nn("D", 4)]),
    "G7":    (nn("G", 2), [nn("B", 3), nn("D", 4), nn("F", 4), nn("G", 4)]),
    "C":     (nn("C", 2), [nn("E", 3), nn("G", 3), nn("C", 4), nn("E", 4)]),
    "Cmaj7": (nn("C", 2), [nn("E", 3), nn("G", 3), nn("B", 3), nn("C", 4)]),
    "A7":    (nn("A", 2), [nn("C#", 4), nn("E", 4), nn("G", 4), nn("A", 4)]),
    "D7":    (nn("D", 2), [nn("F#", 3), nn("A", 3), nn("C", 4), nn("D", 4)]),
    "Bb":    (nn("A#", 2), [nn("D", 4), nn("F", 4), nn("A#", 4)]),
    "Gm7":   (nn("G", 2), [nn("A#", 3), nn("D", 4), nn("F", 4), nn("G", 4)]),
}

EP, UPBASS, CHOIR = 4, 32, 52
KICK, SNARE, RIDE, HHC = 36, 38, 51, 42


def _events(track, ch, program, notes):
    if program is not None:
        track.append(Message("program_change", channel=ch, program=program, time=0))
    track.append(Message("control_change", channel=ch, control=91, value=64, time=0))
    ev = []
    for (beat, dur, pitch, vel) in notes:
        a = int(beat * TPB); b = int((beat + dur) * TPB) - 3
        ev.append((a, 1, pitch, vel)); ev.append((max(a + 1, b), 0, pitch, 0))
    ev.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for (tick, kind, pitch, vel) in ev:
        dt = tick - last; last = tick
        track.append(Message("note_on" if kind else "note_off", channel=ch,
                             note=pitch, velocity=vel if kind else 0, time=dt))


def compose_jingle(text, chords, melody, bpm=98):
    """chords: list of chord names (2 beats each). melody: (beat,dur,'Name',oct)."""
    mid = MidiFile(ticks_per_beat=TPB)
    meta = MidiTrack(); mid.tracks.append(meta)
    meta.append(MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    beats_per_chord = 2
    total_beats = len(chords) * beats_per_chord
    # comp (Rhodes) + bass
    ep_notes, bass_notes = [], []
    for i, ch in enumerate(chords):
        root, voi = VOICING[ch]
        b0 = i * beats_per_chord
        for p in voi:
            ep_notes.append((b0, beats_per_chord * 0.95, p, 62))
        bass_notes.append((b0, 1, root, 82))
        bass_notes.append((b0 + 1, 1, root + 7, 70))
    # soft swing drums
    dr_notes = []
    for b in range(total_beats):
        dr_notes.append((b, 0.5, RIDE, 46))
        dr_notes.append((b + 0.66, 0.3, RIDE, 34))
        if b % 2 == 0:
            dr_notes.append((b, 0.5, KICK, 60))
        else:
            dr_notes.append((b, 0.3, SNARE, 40))
    # choir melody (the sung hook)
    mel_notes = [(beat, dur, nn(name, octv), 96) for (beat, dur, name, octv) in melody]

    t_ep = MidiTrack(); mid.tracks.append(t_ep); _events(t_ep, 0, EP, ep_notes)
    t_b = MidiTrack(); mid.tracks.append(t_b); _events(t_b, 1, UPBASS, bass_notes)
    t_d = MidiTrack(); mid.tracks.append(t_d); _events(t_d, 9, None, dr_notes)
    t_c = MidiTrack(); mid.tracks.append(t_c); _events(t_c, 2, CHOIR, mel_notes)

    midp = os.path.join(OUT, "_j.mid"); mid.save(midp)
    bed = os.path.join(OUT, "_jbed.wav")
    subprocess.run(["fluidsynth", "-ni", "-g", "0.9", "-F", bed, "-r", str(SR), "-R", "1", SF2, midp],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bed_dur = total_beats * 60.0 / bpm
    # dreamy spoken line
    v = bw.tts(text, voice="af_heart", speed=0.74)
    raw = os.path.join(OUT, "_jvox.wav"); bw.write_wav(raw, v)
    ech = os.path.join(OUT, "_jvoxE.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw,
                    "-af", "aecho=0.8:0.5:60|130:0.3|0.2,volume=1.15", "-ar", str(SR), "-ac", "1", ech],
                   check=True)
    out = os.path.join(OUT, "_jingle.wav")
    # mix: bed + vocal (vocal slightly delayed to let the chord land)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", bed, "-i", ech, "-filter_complex",
                    "[0:a]volume=1.0[b];[1:a]adelay=250|250,volume=1.5[v];"
                    "[b][v]amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.97,"
                    "loudnorm=I=-15:TP=-1.5[a]",
                    "-map", "[a]", "-c:a", "pcm_s16le", "-ar", str(SR), "-ac", "1", out], check=True)
    return out, max(bw_dur(out), bed_dur + 0.3)


# ---------------------------------------------------------------- content
E = bw.E
YEL = "#FFF3B0"


def rainbow(a, b):
    return [E(0.0, "rainbow", x=960, y=470, s=a, sz=92),
            E(0.14, "rainbow", x=960, y=610, s=b, sz=92)]


# each: (kind 'n'/'j', text, caption(for n), bg, elements, [jingle chords+melody for j])
SEGS = [
    ("n", "hi. this is england. it's part of an island, off the coast of europe, that spent most of history being extremely busy.",
     "sky", [E(0.0, "sun", x=1560, y=200, r=110),
             E(0.2, "blob", x=820, y=600, r=250, c="#7FB069", label="england")]),
    ("n", "before anyone wrote things down, people were already here, building giant stone circles like stonehenge, for reasons they did not leave a note about.",
     "mint", [E(0.0, "text", x=960, y=200, s="stonehenge", sz=80),
              E(0.2, "blob", x=700, y=640, r=120, c="#9AA6AE", label="?"),
              E(0.5, "text", x=1250, y=560, s="(no note)", sz=52, fill=YEL)]),
    ("n", "then, in 43 A.D., the romans showed up, conquered most of it, built dead straight roads, a big wall to keep the scots out, and called it Britannia.",
     "peach", [E(0.0, "text", x=960, y=180, s="43 AD: rome", sz=80),
               E(0.15, "flag", x=650, y=560, h=110, c="#C1121F"),
               E(0.4, "arrow", x1=820, y1=560, x2=1150, y2=560),
               E(0.5, "blob", x=1300, y=600, r=170, c="#7FB069", label="Britannia"),
               E(0.75, "text", x=960, y=860, s="(a very big wall)", sz=44, fill=YEL)]),
    ("n", "around 410, rome had its own problems, and left. all at once. taking the roads maintenance budget with them.",
     "coral", [E(0.0, "text", x=960, y=200, s="410 AD", sz=90),
               E(0.2, "flag", x=700, y=600, h=120, c="#C1121F"),
               E(0.4, "arrow", x1=850, y1=560, x2=1300, y2=480),
               E(0.6, "text", x=1300, y=560, s="bye", sz=70)]),
    ("j", "you could just, leave an island", None, "space", None,
     (["Fmaj7", "Em7", "Dm7", "G7"], [(0, 1, "A", 4), (1, 1, "G", 4), (2, 2, "F", 4),
                                       (4, 1, "F", 4), (5, 1, "G", 4), (6, 2, "A", 4)])),
    ("n", "into the gap came the angles, the saxons, and the jutes. germanic tribes who moved in, split into little kingdoms, and gave the country its name. angle-land. england.",
     "lemon", [E(0.0, "text", x=960, y=170, s="angles + saxons + jutes", sz=54, fill="#5A4630"),
               E(0.3, "blob", x=700, y=560, r=110, c="#E4572E", label="wessex", lsz=28),
               E(0.45, "blob", x=950, y=520, r=110, c="#4361EE", label="mercia", lsz=28),
               E(0.6, "blob", x=1200, y=580, r=110, c="#06D6A0", label="northumbria", lsz=24),
               E(0.8, "text", x=960, y=880, s="angle-land -> england", sz=46, fill="#5A4630")]),
    ("n", "then, in 793, the vikings arrived. by boat. with axes. and a strong interest in other people's monasteries. it did not go great for the monasteries.",
     "blue", [E(0.0, "text", x=960, y=180, s="793: vikings", sz=84),
              E(0.25, "blob", x=700, y=600, r=150, c="#7FB069", label="england"),
              E(0.5, "arrow", x1=1300, y1=520, x2=900, y2=580),
              E(0.65, "burst", x=850, y=580, r=120, label="raid")]),
    ("n", "one saxon king, alfred the great, actually fought them off, made a deal, and is mostly remembered today for a legend about burning some cakes.",
     "sunset", [E(0.0, "crown", x=700, y=430, w=170),
                E(0.15, "text", x=700, y=560, s="alfred the great", sz=48),
                E(0.5, "burst", x=1250, y=560, r=110, label="the cakes"),
                E(0.75, "text", x=1250, y=720, s="(he burnt them)", sz=40, fill=YEL)]),
    ("n", "and then came the year everyone remembers. 1066. the king died, three people claimed the throne, and a norman named william sailed over to settle it in person.",
     "lavender", [E(0.0, "text", x=960, y=200, s="1066", sz=120),
                  E(0.3, "crown", x=760, y=520, w=150),
                  E(0.45, "text", x=760, y=620, s="who's king?", sz=40),
                  E(0.65, "flag", x=1250, y=560, h=120, c="#4361EE"),
                  E(0.8, "text", x=1250, y=720, s="william", sz=46)]),
    ("n", "at the battle of hastings, he won, took an arrow-related throne, built castles everywhere, wrote down everyone's stuff in a big book, and became william the conqueror.",
     "peach", [E(0.0, "text", x=960, y=170, s="battle of hastings", sz=60),
               E(0.25, "burst", x=700, y=560, r=150, label="1066"),
               E(0.5, "crown", x=1150, y=470, w=170),
               E(0.7, "scroll", x=1250, y=650, w=360, h=260),
               E(0.82, "text", x=1250, y=650, s="domesday book", sz=34, fill="#5A4630")]),
    ("j", "you could conquer england, in one day", None, "space", None,
     (["Am7", "Dm7", "G7", "Cmaj7"], [(0, 1, "E", 4), (1, 1, "F", 4), (2, 2, "G", 4),
                                       (4, 1, "E", 4), (5, 1, "D", 4), (6, 2, "C", 4)])),
    ("n", "the medieval bit was busy. in 1215, some very annoyed barons made king john sign the magna carta, a document that said, quietly, that maybe the king couldn't just do anything.",
     "mint", [E(0.0, "text", x=960, y=170, s="1215: magna carta", sz=62),
              E(0.3, "scroll", x=700, y=580, w=520, h=380),
              E(0.55, "crown", x=1300, y=470, w=160),
              E(0.7, "text", x=1300, y=600, s="king john :(", sz=42),
              E(0.85, "text", x=960, y=900, s="the king: no longer allowed to just do stuff", sz=36, fill="#5A4630")]),
    ("n", "then the black death arrived and killed about a third of everyone, and england fought a war with france that lasted so long it was literally called the hundred years war.",
     "sunset", [E(0.0, "burst", x=680, y=520, r=160, label="black death"),
                E(0.4, "text", x=680, y=720, s="~1/3 of everyone", sz=40, fill="#7A2E2E"),
                E(0.6, "flag", x=1150, y=520, h=100, c="#7FB069"),
                E(0.7, "burst", x=1330, y=560, r=90),
                E(0.8, "flag", x=1500, y=520, h=100, c="#4361EE"),
                E(0.9, "text", x=1300, y=720, s="100 years war", sz=40)]),
    ("n", "then two branches of the royal family, with a red rose and a white rose, fought over the throne in the wars of the roses. eventually a tudor won, and married the two roses into one.",
     "coral", [E(0.0, "text", x=960, y=170, s="wars of the roses", sz=58),
               E(0.3, "blob", x=680, y=560, r=130, c="#E4572E", label="lancaster", lsz=30),
               E(0.45, "text", x=960, y=560, s="VS", sz=64),
               E(0.55, "blob", x=1240, y=560, r=130, c="#EAEAEA", label="york", lsz=32),
               E(0.8, "crown", x=960, y=800, w=150)]),
    ("n", "the tudors are the famous ones. henry the eighth wanted a divorce, the pope said no, so he invented a whole new church so he could say yes to himself.",
     "lemon", [E(0.0, "crown", x=700, y=430, w=190),
               E(0.15, "text", x=700, y=560, s="henry VIII", sz=56, fill="#5A4630"),
               E(0.45, "text", x=1300, y=430, s="the pope: no", sz=44, fill="#5A4630"),
               E(0.65, "arrow", x1=1300, y1=490, x2=1300, y2=600),
               E(0.8, "text", x=1300, y=680, s="new church: yes", sz=44, fill="#5A4630")]),
    ("j", "divorced, beheaded, and died. divorced, beheaded, survived", None, "space", None,
     (["Dm7", "G7", "Cmaj7", "Am7", "Dm7", "G7", "Cmaj7", "C"],
      [(0, 1, "D", 4), (1, 1, "E", 4), (2, 1, "F", 4), (3, 1, "E", 4),
       (4, 1, "D", 4), (5, 1, "C", 4), (6, 2, "D", 4),
       (8, 1, "D", 4), (9, 1, "E", 4), (10, 1, "F", 4), (11, 1, "G", 4),
       (12, 1, "F", 4), (13, 1, "E", 4), (14, 2, "C", 4)])),
    ("n", "his daughter, elizabeth the first, never married, ran the country for forty five years, beat the spanish armada, and presided over a golden age with some guy named shakespeare in it.",
     "lavender", [E(0.0, "crown", x=700, y=430, w=180),
                  E(0.15, "text", x=700, y=560, s="elizabeth I", sz=56),
                  E(0.45, "flag", x=1250, y=520, h=100, c="#FFB703"),
                  E(0.55, "burst", x=1400, y=560, r=100, label="armada"),
                  E(0.8, "text", x=960, y=880, s="+ one (1) shakespeare", sz=42, fill=YEL)]),
    ("n", "then the stuarts. scotland's king inherited england too, some people tried to blow up parliament, and then the country got so angry at its king that it fought a civil war and cut his head off.",
     "sky", [E(0.0, "text", x=960, y=170, s="the stuarts", sz=64),
             E(0.25, "text", x=680, y=430, s="1605: gunpowder plot", sz=40),
             E(0.45, "burst", x=680, y=580, r=120, label="boom?"),
             E(0.65, "crown", x=1300, y=470, w=160),
             E(0.8, "arrow", x1=1300, y1=560, x2=1420, y2=640),
             E(0.9, "text", x=1300, y=720, s="charles I: headless", sz=40)]),
    ("n", "for a bit, england had no king at all, just a stern man named cromwell. everyone found this so boring they invited the monarchy back within about a decade.",
     "peach", [E(0.0, "text", x=960, y=300, s="england: no king", sz=64),
               E(0.3, "text", x=960, y=430, s="just cromwell", sz=48, fill="#5A4630"),
               E(0.6, "text", x=960, y=640, s="england: ...actually, come back", sz=44, fill="#5A4630")]),
    ("n", "in 1707, england and scotland officially merged into great britain, and then great britain did the single most british thing possible. it went out, and acquired an enormous empire.",
     "teal", [E(0.0, "text", x=960, y=180, s="1707: great britain", sz=60),
              E(0.3, "blob", x=760, y=560, r=130, c="#7FB069", label="england"),
              E(0.4, "blob", x=980, y=470, r=110, c="#4361EE", label="scotland", lsz=30),
              E(0.7, "earth", x=1400, y=580, r=200),
              E(0.85, "text", x=1400, y=820, s="mine now", sz=44)]),
    ("n", "powered by the industrial revolution, steam engines, and a truly heroic amount of tea, the british empire grew so large that the sun genuinely never set on it.",
     "sunset", [E(0.0, "text", x=960, y=170, s="the empire", sz=70),
                E(0.3, "earth", x=760, y=580, r=210),
                E(0.6, "sun", x=1350, y=520, r=120),
                E(0.8, "text", x=1350, y=760, s="never sets", sz=46, fill=YEL)]),
    ("n", "then came two enormous world wars. britain got through the second one by standing on a small island, refusing to give up, and telling everyone to keep calm.",
     "coral", [E(0.0, "text", x=960, y=180, s="the world wars", sz=64),
               E(0.3, "blob", x=760, y=600, r=170, c="#7FB069", label="britain"),
               E(0.6, "burst", x=1150, y=560, r=110, label="the blitz"),
               E(0.8, "scroll", x=1420, y=620, w=380, h=240),
               E(0.9, "text", x=1420, y=620, s="KEEP CALM", sz=44, fill="#5A4630")]),
    ("n", "after the wars, the empire quietly let everyone go, britain built a national health service, joined europe, left europe again, and mostly settled into being a place with very strong opinions about tea.",
     "mint", [E(0.0, "text", x=960, y=180, s="the modern bit", sz=60),
              E(0.3, "earth", x=700, y=580, r=180),
              E(0.5, "text", x=700, y=800, s="empire -> bye", sz=40),
              E(0.65, "text", x=1250, y=430, s="join EU", sz=44),
              E(0.78, "text", x=1250, y=520, s="leave EU", sz=44),
              E(0.9, "text", x=1250, y=680, s="strong tea opinions", sz=42, fill="#5A4630")]),
    ("j", "that's the history of england, i guess", None, "space", None,
     (["Fmaj7", "Em7", "Dm7", "G7", "Cmaj7", "Am7", "Dm7", "G7"],
      [(0, 1, "A", 4), (1, 1, "B", 4), (2, 1, "C", 5), (3, 1, "B", 4),
       (4, 1, "A", 4), (5, 1, "G", 4), (6, 1, "F", 4), (7, 1, "E", 4),
       (8, 2, "F", 4), (10, 2, "E", 4), (12, 4, "C", 4)])),
    ("e", "", None, "space",
     [E(0.0, "rainbow", x=960, y=470, s="the history of england", sz=90),
      E(0.3, "rainbow", x=960, y=600, s="i guess", sz=90),
      E(0.7, "text", x=960, y=820, s="please subscribe or g minus eats the fish. yes, still.", sz=36, fill="#DDDDDD")],
     None),
]


def main():
    seg_files, durations = [], []
    for i, seg in enumerate(SEGS):
        kind, text = seg[0], seg[1]
        wav = os.path.join(OUT, f"seg{i:03d}.wav")
        done = os.path.join(OUT, f"seg{i:03d}.done")
        mp4 = os.path.join(OUT, f"seg{i:03d}.mp4")
        if os.path.exists(done):
            durations.append(bw_dur(wav)); seg_files.append(mp4); continue
        if kind == "j":
            bg = seg[3]; chords, melody = seg[5]
            jwav, jdur = compose_jingle(text, chords, melody)
            import shutil; shutil.copy(jwav, wav)
            els = rainbow(*text_split(text))
            dur = bw_dur(wav)
        elif kind == "e":
            bg = seg[3]; els = seg[4]
            audio = bw.pad_chord([bw.freq("F", 3), bw.freq("A", 3), bw.freq("C", 4), bw.freq("E", 4)], 4.5, 0.5) * 0.6
            audio = np.concatenate([audio, np.zeros(int(0.5 * SR))])
            bw.write_wav(wav, audio); dur = bw_dur(wav)
        else:  # narration: (kind, text, bg, els)
            bg = seg[2]; els = seg[3]
            v = bw.tts(text, voice="am_michael", speed=1.12)
            v = np.concatenate([v, np.zeros(int(0.22 * SR))])
            bw.write_wav(wav, v); dur = bw_dur(wav)
        durations.append(dur)
        cap = text if kind == "n" else ""
        bw.render_segment_video(i, bg, els, cap, dur, wav)
        open(done, "w").close()
        seg_files.append(mp4)
        print(f"[{i+1}/{len(SEGS)}] {kind} {dur:.1f}s", flush=True)

    lst = os.path.join(OUT, "list.txt")
    with open(lst, "w") as f:
        for p in seg_files:
            f.write(f"file '{os.path.abspath(p)}'\n")
    joined = os.path.join(OUT, "joined.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined], check=True)
    total = sum(durations); print(f"total {total:.1f}s", flush=True)
    bw.write_wav(os.path.join(OUT, "bed.wav"), bw.music_bed(total))
    final = os.path.join(OUT, "history_of_england_i_guess.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", joined, "-i", os.path.join(OUT, "bed.wav"),
                    "-filter_complex",
                    "[1:a]volume=0.10[m];[0:a]volume=1.3[v];[v][m]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final], check=True)
    print("FINAL:", final, flush=True)


def bw_dur(wav):
    out = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                          "-of", "csv=p=0", wav], capture_output=True, text=True)
    return float(out.stdout.strip())


def text_split(t):
    words = t.split()
    mid = len(words) // 2
    return " ".join(words[:mid]), " ".join(words[mid:])


if __name__ == "__main__":
    main()
