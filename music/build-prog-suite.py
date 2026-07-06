#!/usr/bin/env python3
"""THE LONG WAY UP — an original progressive-rock instrumental suite.

Composed as MIDI, rendered per-movement through the FluidR3 GM soundfont
(fluidsynth), then concatenated. Key: E minor. Recurring main theme + a 7/8
main riff tie the movements together. All original composition.
"""
import os
import subprocess

import mido
from mido import Message, MetaMessage, MidiFile, MidiTrack

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "out")
os.makedirs(OUT, exist_ok=True)
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
TPB = 480  # ticks per beat

# GM programs
DIST = 30      # distortion guitar
OD = 29        # overdriven guitar
ORGAN = 18     # rock organ
BASS = 33      # finger bass
PICKB = 34     # picked bass
EPIANO = 4     # electric piano
CLEANG = 27    # clean electric guitar
STRINGS = 48   # strings ensemble
PAD = 89       # warm pad
LEAD = 81      # saw lead
SQUARE = 80    # square lead
DRUMS_CH = 9

# GM drums
KICK, SNARE, HHC, HHO, CRASH, RIDE = 36, 38, 42, 46, 49, 51
TOM_HI, TOM_MID, TOM_LO = 50, 47, 43

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6,
        "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def n(name, octave):
    return NOTE[name] + 12 * (octave + 1)


# scales
EM = [n("E", 3), n("F#", 3), n("G", 3), n("A", 3), n("B", 3), n("C", 4), n("D", 4)]
E_BLUES = [n("E", 3), n("G", 3), n("A", 3), n("A#", 3), n("B", 3), n("D", 4),
           n("E", 4), n("G", 4), n("A", 4), n("A#", 4), n("B", 4), n("D", 5), n("E", 5)]

CHORD = {  # root position triads (low)
    "Em": [n("E", 2), n("G", 2), n("B", 2)],
    "C":  [n("C", 2), n("E", 2), n("G", 2)],
    "G":  [n("G", 2), n("B", 2), n("D", 3)],
    "D":  [n("D", 2), n("F#", 2), n("A", 2)],
    "Am": [n("A", 2), n("C", 3), n("E", 3)],
    "B":  [n("B", 1), n("D#", 2), n("F#", 2)],
    "Bm": [n("B", 1), n("D", 2), n("F#", 2)],
}
ROOT = {"Em": n("E", 1), "C": n("C", 2), "G": n("G", 1), "D": n("D", 2),
        "Am": n("A", 1), "B": n("B", 1), "Bm": n("B", 1)}


# ---------------------------------------------------------------- MIDI plumbing
class Part:
    def __init__(self, channel, program):
        self.ch = channel
        self.program = program
        self.ev = []  # (abs_tick, 'on'/'off', pitch, vel)

    def note(self, beat, dur, pitch, vel=90):
        a = int(beat * TPB)
        b = int((beat + dur) * TPB) - 2
        self.ev.append((a, 1, pitch, vel))
        self.ev.append((max(a + 1, b), 0, pitch, 0))

    def chord(self, beat, dur, pitches, vel=80):
        for p in pitches:
            self.note(beat, dur, p, vel)


def write_movement(path, tempo_bpm, parts, tsig=(4, 4)):
    mid = MidiFile(ticks_per_beat=TPB)
    meta = MidiTrack(); mid.tracks.append(meta)
    meta.append(MetaMessage("set_tempo", tempo=mido.bpm2tempo(tempo_bpm), time=0))
    meta.append(MetaMessage("time_signature", numerator=tsig[0], denominator=tsig[1], time=0))
    for part in parts:
        tr = MidiTrack(); mid.tracks.append(tr)
        if part.ch != DRUMS_CH:
            tr.append(Message("program_change", channel=part.ch, program=part.program, time=0))
        tr.append(Message("control_change", channel=part.ch, control=91, value=60, time=0))  # reverb
        evs = sorted(part.ev, key=lambda e: (e[0], e[1]))
        last = 0
        for (tick, kind, pitch, vel) in evs:
            dt = tick - last; last = tick
            if kind == 1:
                tr.append(Message("note_on", channel=part.ch, note=pitch, velocity=vel, time=dt))
            else:
                tr.append(Message("note_off", channel=part.ch, note=pitch, velocity=0, time=dt))
    mid.save(path)


# ---------------------------------------------------------------- drum helpers
def rock_beat(dr, bar, beats=4, fill=False, ride=False):
    b0 = bar * beats
    hat = RIDE if ride else HHC
    for i in range(beats):
        dr.note(b0 + i, 0.25, hat, 70)
        dr.note(b0 + i + 0.5, 0.25, hat, 55)
    dr.note(b0 + 0, 0.5, KICK, 110)
    dr.note(b0 + 2, 0.5, KICK, 105)
    dr.note(b0 + 1, 0.5, SNARE, 100)
    dr.note(b0 + 3, 0.5, SNARE, 100)
    if fill:
        dr.note(b0 + 3, 0.25, TOM_HI, 100)
        dr.note(b0 + 3.25, 0.25, TOM_MID, 100)
        dr.note(b0 + 3.5, 0.25, TOM_MID, 105)
        dr.note(b0 + 3.75, 0.25, TOM_LO, 110)


def beat_78(dr, bar):  # 7/8: 3+2+2 accent
    b0 = bar * 3.5
    for i in [0, 0.5, 1, 1.5, 2, 2.5, 3]:
        dr.note(b0 + i, 0.25, HHC, 60)
    dr.note(b0 + 0, 0.5, KICK, 112)
    dr.note(b0 + 1.5, 0.5, SNARE, 105)
    dr.note(b0 + 2.5, 0.5, KICK, 100)
    dr.note(b0 + 3, 0.5, SNARE, 100)


# recurring melodic material (E minor)
MAIN_THEME = [  # (beat, dur, pitch) over 8 beats: Em C G D
    (0, 1, n("B", 4)), (1, 0.5, n("G", 4)), (1.5, 0.5, n("A", 4)), (2, 2, n("B", 4)),
    (4, 1, n("C", 5)), (5, 1, n("B", 4)), (6, 2, n("G", 4)),
]
MAIN_THEME2 = [
    (0, 1, n("G", 4)), (1, 0.5, n("A", 4)), (1.5, 0.5, n("B", 4)), (2, 2, n("D", 5)),
    (4, 1, n("B", 4)), (5, 1, n("A", 4)), (6, 2, n("E", 4)),
]
PROG_THEME = ["Em", "C", "G", "D"]


def add_prog(part_bass, part_ch, prog, start_bar, bars, beats=4, organ=True):
    for b in range(bars):
        ch = prog[b % len(prog)]
        bar = start_bar + b
        # bass: root + octave walk
        r = ROOT[ch]
        part_bass.note(bar * beats, 1, r, 100)
        part_bass.note(bar * beats + 1, 0.5, r + 12, 85)
        part_bass.note(bar * beats + 2, 1, r, 95)
        part_bass.note(bar * beats + 3, 0.5, r + 7, 85)
        if organ:
            part_ch.chord(bar * beats, beats, [p + 12 for p in CHORD[ch]], 62)


# ---------------------------------------------------------------- movements
def mov1_overture():
    """Atmospheric intro: strings pad + organ states the theme. ~free, slow."""
    strings = Part(0, STRINGS); organ = Part(1, ORGAN); bass = Part(2, BASS)
    # sustained pad chords: Em - C - G - D (whole notes, 4 beats each)
    for b, ch in enumerate(["Em", "C", "G", "D", "Em", "C", "Am", "B"]):
        strings.chord(b * 4, 4, [p + 12 for p in CHORD[ch]], 55)
        bass.note(b * 4, 4, ROOT[ch], 70)
    # organ plays main theme starting bar 4 (beat 16)
    for (beat, dur, p) in MAIN_THEME:
        organ.note(16 + beat, dur, p, 78)
    for (beat, dur, p) in MAIN_THEME2:
        organ.note(24 + beat, dur, p, 78)
    write_movement(f"{OUT}/m1.mid", 82, [strings, organ, bass])
    return "m1", 82, 32 / 4  # bars/beats not used


def mov2_riff():
    """The 7/8 main riff: distortion guitar + bass + drums. Driving."""
    gtr = Part(0, DIST); bass = Part(2, PICKB); dr = Part(DRUMS_CH, 0)
    bars = 16
    # 7/8 riff on E pedal with b6/b7 color; one bar = 3.5 beats
    riff = [(0, 0.5, n("E", 3)), (0.5, 0.5, n("E", 3)), (1, 0.5, n("G", 3)),
            (1.5, 0.5, n("E", 3)), (2, 0.5, n("D", 3)), (2.5, 0.5, n("E", 3)), (3, 0.5, n("C", 3))]
    for bar in range(bars):
        base = bar * 3.5
        for (o, d, p) in riff:
            gtr.note(base + o, d, p, 108)
            gtr.note(base + o, d, p - 12, 100)  # octave down (power)
            gtr.note(base + o, d, p + 7, 92)     # fifth (power chord)
        # bass locks the low E pedal with the accent pattern
        for o in [0, 0.5, 1, 1.5, 2, 2.5, 3]:
            bass.note(base + o, 0.45, n("E", 1), 100)
        beat_78(dr, bar)
        if bar % 4 == 3:
            dr.note(base + 3, 0.5, CRASH, 100)
    write_movement(f"{OUT}/m2.mid", 150, [gtr, bass, dr], tsig=(7, 8))
    return "m2", 150, bars * 3.5


def mov3_theme():
    """Anthemic theme: organ lead over rock groove, distortion pads."""
    organ = Part(0, ORGAN); gtr = Part(1, OD); bass = Part(2, BASS); dr = Part(DRUMS_CH, 0)
    bars = 16
    add_prog(bass, gtr, PROG_THEME, 0, bars, beats=4, organ=True)
    # organ plays theme (twice) + a variation
    seq = MAIN_THEME + [(b + 8, d, p) for (b, d, p) in MAIN_THEME2]
    for rep in range(2):
        for (beat, dur, p) in seq:
            organ.note(rep * 16 + beat, dur, p + 12, 88)
    for bar in range(bars):
        rock_beat(dr, bar, fill=(bar % 4 == 3), ride=(bar >= 8))
        if bar % 8 == 0:
            dr.note(bar * 4, 1, CRASH, 95)
    write_movement(f"{OUT}/m3.mid", 118, [organ, gtr, bass, dr])
    return "m3", 118, bars * 4


def mov4_interlude():
    """Quiet 6/8 interlude: e-piano arpeggios + clean guitar + pad."""
    ep = Part(0, EPIANO); cg = Part(1, CLEANG); pad = Part(2, PAD); bass = Part(3, BASS)
    prog = ["Em", "Am", "D", "G", "Em", "Am", "B", "B"]
    beats = 3  # 6/8 felt as 2 dotted; use 3 eighth-groups -> 3 "beats" per bar
    for bar, ch in enumerate(prog):
        pcs = CHORD[ch]
        base = bar * 3
        # arpeggio (e-piano) 6 eighths
        arp = [pcs[0] + 12, pcs[1] + 12, pcs[2] + 12, pcs[0] + 24, pcs[2] + 12, pcs[1] + 12]
        for i, p in enumerate(arp):
            ep.note(base + i * 0.5, 0.5, p, 62)
        pad.chord(base, 3, [p + 12 for p in pcs], 42)
        bass.note(base, 1.5, ROOT[ch], 70)
        bass.note(base + 1.5, 1.5, ROOT[ch], 62)
    # clean guitar plays a gentle version of the theme in second half
    for (beat, dur, p) in MAIN_THEME:
        cg.note(12 + beat * 0.75, dur * 0.75, p, 66)
    write_movement(f"{OUT}/m4.mid", 132, [ep, cg, pad, bass], tsig=(6, 8))
    return "m4", 132, len(prog) * 3


def mov5_build():
    """Build-up: riff returns under a rising organ, tom groove, crescendo."""
    gtr = Part(0, DIST); organ = Part(1, ORGAN); bass = Part(2, PICKB); dr = Part(DRUMS_CH, 0)
    bars = 8
    riff = [(0, 0.5, n("E", 3)), (0.5, 0.5, n("G", 3)), (1, 0.5, n("A", 3)),
            (1.5, 0.5, n("B", 3)), (2, 0.5, n("D", 4)), (2.5, 0.5, n("B", 3)),
            (3, 0.5, n("A", 3)), (3.5, 0.5, n("G", 3))]
    for bar in range(bars):
        base = bar * 4
        vel = 80 + bar * 5
        for (o, d, p) in riff:
            gtr.note(base + o, d, p - 12, min(vel, 120))
            gtr.note(base + o, d, p - 5, min(vel, 118))
        for o in [0, 1, 2, 3]:
            bass.note(base + o, 0.9, n("E", 1), min(vel, 118))
        # rising organ sustained cluster
        organ.chord(base, 4, [n("E", 4), n("B", 4), n("E", 5)], min(60 + bar * 6, 100))
        # tom-driven groove getting busier
        for i in range(4):
            dr.note(base + i, 0.25, KICK, 110)
            dr.note(base + i + 0.5, 0.25, (TOM_LO if bar < 4 else SNARE), 90 + bar * 3)
        dr.note(base, 0.25, CRASH, 90)
    write_movement(f"{OUT}/m5.mid", 150, [gtr, organ, bass, dr])
    return "m5", 150, bars * 4


def mov6_climax():
    """Climax: saw-lead solo over the main progression, full band."""
    import random
    rng = random.Random(7)
    lead = Part(0, LEAD); gtr = Part(1, DIST); organ = Part(2, ORGAN)
    bass = Part(3, PICKB); dr = Part(DRUMS_CH, 0)
    bars = 16
    add_prog(bass, organ, PROG_THEME, 0, bars, beats=4, organ=True)
    # rhythm guitar power chords on the prog
    for bar in range(bars):
        ch = PROG_THEME[bar % 4]; r = ROOT[ch] + 24
        for o in [0, 1, 2, 3]:
            gtr.note(bar * 4 + o, 0.9, r, 96)
            gtr.note(bar * 4 + o, 0.9, r + 7, 92)
        rock_beat(dr, bar, fill=(bar % 4 == 3), ride=True)
        if bar % 4 == 0:
            dr.note(bar * 4, 1, CRASH, 100)
    # lead solo: phrased blues-scale melody with rests
    beat = 0.0
    while beat < bars * 4 - 1:
        if rng.random() < 0.22:
            beat += rng.choice([0.5, 1.0]); continue  # rest = phrasing
        dur = rng.choice([0.25, 0.5, 0.5, 1.0, 1.5])
        p = rng.choice(E_BLUES[3:])  # upper register
        lead.note(beat, dur, p, rng.randint(96, 116))
        # occasional quick hammer
        if dur <= 0.5 and rng.random() < 0.3:
            lead.note(beat + dur, 0.25, p + rng.choice([2, 3]), 100)
            beat += 0.25
        beat += dur
    write_movement(f"{OUT}/m6.mid", 118, [lead, gtr, organ, bass, dr])
    return "m6", 118, bars * 4


def mov7_reprise():
    """Reprise the theme (organ+guitar) then a big final decay."""
    organ = Part(0, ORGAN); gtr = Part(1, OD); strings = Part(2, STRINGS)
    bass = Part(3, BASS); dr = Part(DRUMS_CH, 0)
    bars = 10
    prog = ["Em", "C", "G", "D", "Em", "C", "Am", "B", "Em", "Em"]
    for bar in range(min(bars, len(prog))):
        ch = prog[bar]; base = bar * 4
        organ.chord(base, 4, [p + 12 for p in CHORD[ch]], 82)
        strings.chord(base, 4, [p + 24 for p in CHORD[ch]], 55)
        bass.note(base, 2, ROOT[ch], 92); bass.note(base + 2, 2, ROOT[ch], 88)
        if bar < 8:
            for o in [0, 1, 2, 3]:
                gtr.note(base + o, 0.9, ROOT[ch] + 24, 88)
            rock_beat(dr, bar, fill=(bar == 7))
        if bar == 8:  # ritard feel: sparse
            dr.note(base, 1, CRASH, 100)
    # final big Em chord, long decay
    fin = 8 * 4
    for p in [n("E", 1), n("E", 2), n("G", 2), n("B", 2), n("E", 3), n("B", 3), n("E", 4)]:
        organ.note(fin, 8, p, 100)
    strings.chord(fin, 8, [n("E", 3), n("G", 3), n("B", 3), n("E", 4)], 70)
    gtr.chord(fin, 8, [n("E", 3), n("B", 3), n("E", 4)], 100)
    dr.note(fin, 1, CRASH, 118)
    dr.note(fin, 8, RIDE, 60)
    write_movement(f"{OUT}/m7.mid", 76, [organ, gtr, strings, bass, dr])
    return "m7", 76, 10 * 4


def render(tag):
    wav = f"{OUT}/{tag}.wav"
    subprocess.run(["fluidsynth", "-ni", "-g", "0.7", "-F", wav, "-r", "44100",
                    "-R", "1", SF2, f"{OUT}/{tag}.mid"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return wav


def main():
    movs = [mov1_overture(), mov2_riff(), mov3_theme(), mov4_interlude(),
            mov5_build(), mov6_climax(), mov7_reprise()]
    wavs = []
    for (tag, bpm, _) in movs:
        w = render(tag)
        import wave as wv
        with wv.open(w) as f:
            dur = f.getnframes() / f.getframerate()
        print(f"{tag}: {dur:.1f}s", flush=True)
        wavs.append(w)
    # concat with short crossfades for smooth segues
    lst = f"{OUT}/list.txt"
    with open(lst, "w") as f:
        for w in wavs:
            f.write(f"file '{os.path.abspath(w)}'\n")
    raw = f"{OUT}/suite_raw.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", raw], check=True)
    final = f"{OUT}/the_long_way_up.mp3"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw,
                    "-af", "loudnorm=I=-14:TP=-1.5,afade=t=in:st=0:d=1.5",
                    "-b:a", "256k", final], check=True)
    import wave as wv
    with wv.open(raw) as f:
        total = f.getnframes() / f.getframerate()
    print(f"TOTAL {total:.1f}s -> {final}", flush=True)


if __name__ == "__main__":
    main()
