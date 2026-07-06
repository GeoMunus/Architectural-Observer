#!/usr/bin/env python3
"""THE PUBLIC DOMAIN POLKA — a Weird-Al-style polka medley of public-domain tunes.

Original oom-pah arrangements (accordion + tuba + clarinet + trumpet + polka
drums) of PUBLIC DOMAIN melodies, rendered via fluidsynth and concatenated with
brass-stab "HEY!" transitions. All source tunes are public domain.
"""
import os
import subprocess
import wave

import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "polka_out")
os.makedirs(OUT, exist_ok=True)
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
TPB = 480

ACCORDION, TUBA, CLARINET, TRUMPET, GLOCK = 21, 58, 71, 56, 9
KICK, SNARE, HH, CRASH = 36, 38, 42, 49
DR = 9

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7,
        "G#": 8, "A": 9, "A#": 10, "B": 11}


def n(name, octv):
    return NOTE[name] + 12 * (octv + 1)


CH = {  # (bass root, accordion chord voicing mid)
    "Em": (n("E", 2), [n("E", 3), n("G", 3), n("B", 3)]),
    "B7": (n("B", 1), [n("D#", 3), n("F#", 3), n("A", 3)]),
    "Am": (n("A", 1), [n("A", 3), n("C", 4), n("E", 4)]),
    "G":  (n("G", 1), [n("G", 3), n("B", 3), n("D", 4)]),
    "D7": (n("D", 2), [n("F#", 3), n("A", 3), n("C", 4)]),
    "C":  (n("C", 2), [n("C", 3), n("E", 3), n("G", 3)]),
    "F":  (n("F", 1), [n("F", 3), n("A", 3), n("C", 4)]),
    "G7": (n("G", 1), [n("B", 3), n("D", 4), n("F", 4)]),
    "A7": (n("A", 1), [n("C#", 4), n("E", 4), n("G", 4)]),
    "Dm": (n("D", 2), [n("D", 3), n("F", 3), n("A", 3)]),
}


class Part:
    def __init__(self, ch, program):
        self.ch = ch; self.program = program; self.ev = []

    def note(self, beat, dur, pitch, vel=90):
        a = int(beat * TPB); b = int((beat + dur) * TPB) - 3
        self.ev.append((a, 1, pitch, vel)); self.ev.append((max(a + 1, b), 0, pitch, 0))

    def mel(self, seq, oct_shift=0, vel=100, t0=0.0):
        for (beat, dur, name, octv) in seq:
            self.note(t0 + beat, dur, n(name, octv + oct_shift), vel)


def write_mid(path, bpm, parts):
    mid = MidiFile(ticks_per_beat=TPB)
    meta = MidiTrack(); mid.tracks.append(meta)
    meta.append(MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    meta.append(MetaMessage("time_signature", numerator=2, denominator=4, time=0))
    for p in parts:
        tr = MidiTrack(); mid.tracks.append(tr)
        if p.ch != DR:
            tr.append(Message("program_change", channel=p.ch, program=p.program, time=0))
        tr.append(Message("control_change", channel=p.ch, control=91, value=50, time=0))
        evs = sorted(p.ev, key=lambda e: (e[0], e[1])); last = 0
        for (tick, kind, pitch, vel) in evs:
            dt = tick - last; last = tick
            tr.append(Message("note_on" if kind else "note_off", channel=p.ch,
                             note=pitch, velocity=vel if kind else 0, time=dt))
    mid.save(path)


def oom_pah(tuba, acc, dr, chords, bars, vel=92, crash0=True):
    """chords: list of chord names, one per bar (2 beats)."""
    for b in range(bars):
        ch = chords[b % len(chords)]
        root, voi = CH[ch]
        base = b * 2
        tuba.note(base + 0, 0.5, root, 100)        # oom
        tuba.note(base + 1, 0.5, root + 7, 88)      # (fifth)
        for p in voi:
            acc.note(base + 1, 0.5, p, vel)         # pah
        dr.note(base + 0, 0.4, KICK, 110)
        dr.note(base + 1, 0.4, SNARE, 96)
        for h in (0, 0.5, 1, 1.5):
            dr.note(base + h, 0.2, HH, 55)
        if crash0 and b == 0:
            dr.note(0, 0.5, CRASH, 100)


def stab(parts_by_name, bars_offset):
    """a short brass 'HEY!' stab tag."""
    tr, ac, tb, dr = parts_by_name
    for p in CH["G7"][1]:
        tr.note(bars_offset * 2, 0.5, p + 12, 110)
        ac.note(bars_offset * 2, 0.5, p, 100)
    tb.note(bars_offset * 2, 0.5, CH["G7"][0], 110)
    dr.note(bars_offset * 2, 0.5, CRASH, 110)
    dr.note(bars_offset * 2, 0.5, KICK, 110)


# ---------------------------------------------------------------- sections (PD tunes)
def s_intro():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); tr = Part(2, TRUMPET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["G", "D7", "G", "D7"], 4)
    # pickup fanfare
    tr.mel([(0, 0.5, "D", 5), (0.5, 0.5, "G", 5), (1, 0.5, "B", 5), (1.5, 0.5, "G", 5),
            (2, 0.5, "D", 5), (2.5, 0.5, "G", 5), (3, 1, "B", 5),
            (6, 0.5, "D", 5), (6.5, 0.5, "A", 5), (7, 1, "G", 5)], vel=108)
    return "intro", 138, [acc, tb, tr, dr]


def s_mountain():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); tr = Part(2, TRUMPET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["Em", "Em", "Em", "B7", "Em", "Em", "Em", "B7"], 8)
    theme = [(0, .5, "E", 4), (.5, .5, "F#", 4), (1, .5, "G", 4), (1.5, .5, "A", 4),
             (2, .5, "B", 4), (2.5, .5, "G", 4), (3, .5, "B", 4),
             (4, .5, "E", 4), (4.5, .5, "F#", 4), (5, .5, "G", 4), (5.5, .5, "A", 4),
             (6, .5, "B", 4), (6.5, .5, "G", 4), (7, .5, "B", 4),
             (8, .5, "B", 4), (8.5, .5, "C", 5), (9, .5, "D", 5), (9.5, .5, "E", 5),
             (10, .5, "F#", 5), (10.5, .5, "D", 5), (11, .5, "F#", 5),
             (12, .5, "E", 4), (12.5, .5, "F#", 4), (13, .5, "G", 4), (13.5, .5, "A", 4),
             (14, .5, "B", 4), (14.5, .5, "G", 4), (15, 1, "E", 4)]
    acc.mel(theme, vel=112)
    return "mountain", 124, [acc, tb, tr, dr]


def s_cancan():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); cl = Part(2, CLARINET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["G", "D7", "G", "D7", "G", "D7", "G", "D7"], 8)
    m = [(0, .5, "D", 5), (1, .5, "G", 4), (1.5, .5, "A", 4),
         (2, .5, "B", 4), (2.5, .5, "A", 4), (3, .5, "G", 4), (3.5, .5, "A", 4),
         (4, .5, "B", 4), (4.5, .5, "B", 4), (5, .5, "C", 5), (5.5, .5, "A", 4),
         (6, .5, "B", 4), (6.5, .5, "G", 4), (7, 1, "D", 5),
         (8, .5, "G", 5), (8.5, .5, "F#", 5), (9, .5, "E", 5), (9.5, .5, "D", 5),
         (10, .5, "C", 5), (10.5, .5, "B", 4), (11, .5, "A", 4), (11.5, .5, "G", 4),
         (12, .5, "A", 4), (12.5, .5, "B", 4), (13, .5, "C", 5), (13.5, .5, "A", 4),
         (14, .5, "G", 4), (14.5, .5, "B", 4), (15, .5, "D", 5), (15.5, .5, "G", 5)]
    cl.mel(m, vel=112)
    return "cancan", 162, [acc, tb, cl, dr]


def s_william():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); tr = Part(2, TRUMPET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["C", "C", "G7", "C", "C", "C", "G7", "C"], 8)
    # galloping figure (da-da-DUM)
    gal = []
    seq = ["E", "E", "E", "E", "E", "E", "E", "E", "E"]
    pat = [("G", 4), ("G", 4), ("C", 5)]
    beat = 0.0
    for bar in range(8):
        for k in range(2):  # two gallops per bar
            notes = [("G", 4), ("G", 4), ("C", 5)] if (bar % 4 != 3) else [("C", 5), ("C", 5), ("E", 5)]
            for j, (nm, oc) in enumerate(notes):
                gal.append((beat + j / 3.0, 1 / 3.0, nm, oc))
            beat += 1
    tr.mel(gal, vel=110)
    return "william", 152, [acc, tb, tr, dr]


def s_camptown():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); cl = Part(2, CLARINET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["G", "G", "D7", "G", "G", "G", "D7", "G"], 8)
    m = [(0, .5, "G", 4), (.5, .5, "G", 4), (1, .5, "E", 4), (1.5, .5, "G", 4),
         (2, .5, "A", 4), (2.5, .5, "G", 4), (3, 1, "E", 4),
         (4, .5, "E", 4), (4.5, .5, "D", 4), (5, 1, "G", 3),        # doo-dah, doo-dah
         (6, 1, "D", 4), (7, 1, "G", 3),
         (8, .5, "G", 4), (8.5, .5, "G", 4), (9, .5, "E", 4), (9.5, .5, "G", 4),
         (10, .5, "A", 4), (10.5, .5, "G", 4), (11, 1, "E", 4),
         (12, .5, "G", 4), (12.5, .5, "E", 4), (13, .5, "D", 4), (14, 2, "G", 4)]
    acc.mel(m, vel=110)
    return "camptown", 140, [acc, tb, cl, dr]


def s_bumblebee():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); cl = Part(2, CLARINET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["Am", "Am", "E7" if False else "A7", "Am"] * 2, 8)
    # rapid chromatic runs (16ths) — the bumblebee chaos
    chromo = list(range(n("A", 5), n("A", 4) - 1, -1)) + list(range(n("A", 4), n("A", 5) + 1))
    beat = 0.0; runs = []
    for bar in range(8):
        for k in range(8):  # 8 sixteenths per 2-beat bar
            p = chromo[(bar * 8 + k) % len(chromo)]
            runs.append((beat, 0.25, p))
            beat += 0.25
    for (b, d, p) in runs:
        cl.note(b, d, p, 104)
    return "bumblebee", 168, [acc, tb, cl, dr]


def s_saints():
    acc = Part(0, ACCORDION); tb = Part(1, TUBA); tr = Part(2, TRUMPET); dr = Part(DR, 0)
    oom_pah(tb, acc, dr, ["C", "C", "C", "G7", "F", "C", "G7", "C"], 8)
    m = [(0, .5, "C", 5), (.5, .5, "E", 5), (1, .5, "F", 5), (1.5, .5, "G", 5),
         (2, 2, "G", 5),
         (4, .5, "C", 5), (4.5, .5, "E", 5), (5, .5, "F", 5), (5.5, .5, "G", 5),
         (6, 2, "G", 5),
         (8, .5, "C", 5), (8.5, .5, "E", 5), (9, .5, "F", 5), (9.5, .5, "G", 5),
         (10, 1, "E", 5), (11, 1, "C", 5),
         (12, 1, "E", 5), (12.5, .5, "D", 5) if False else (13, 1, "D", 5), (14, 2, "C", 5)]
    m = [x for x in m if x]
    tr.mel(m, vel=114)
    # trumpet + accordion doubling for a big finish
    acc.mel(m, oct_shift=-1, vel=90)
    return "saints", 132, [acc, tb, tr, dr]


def render(tag, bpm, parts):
    midp = f"{OUT}/{tag}.mid"; write_mid(midp, bpm, parts)
    wav = f"{OUT}/{tag}.wav"
    subprocess.run(["fluidsynth", "-ni", "-g", "0.8", "-F", wav, "-r", "44100", "-R", "1", SF2, midp],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return wav


def main():
    sections = [s_intro(), s_mountain(), s_cancan(), s_william(),
                s_camptown(), s_bumblebee(), s_saints()]
    wavs = []
    for (tag, bpm, parts) in sections:
        w = render(tag, bpm, parts)
        with wave.open(w) as f:
            print(f"{tag}: {f.getnframes()/f.getframerate():.1f}s", flush=True)
        wavs.append(w)
    lst = f"{OUT}/list.txt"
    with open(lst, "w") as f:
        for w in wavs:
            f.write(f"file '{os.path.abspath(w)}'\n")
    raw = f"{OUT}/polka_raw.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", raw], check=True)
    final = f"{OUT}/the_public_domain_polka.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw,
                    "-af", "loudnorm=I=-14:TP=-1.5,afade=t=in:st=0:d=0.4", "-b:a", "256k", final], check=True)
    with wave.open(raw) as f:
        print(f"TOTAL {f.getnframes()/f.getframerate():.1f}s -> {final}", flush=True)


if __name__ == "__main__":
    main()
