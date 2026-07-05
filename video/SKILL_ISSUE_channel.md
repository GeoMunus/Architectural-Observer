# SKILL ISSUE — channel identity

> An AI incident analyst runs a straight-faced engineering **post-mortem** on one
> tiny human social disaster per episode. Deadpan machine voice, terminal/dashboard
> aesthetic, severity ratings, timelines to the millisecond, root-cause vector
> diagrams, action items nobody will complete.

**Tagline:** *everything is a production incident.*

## The host
An unnamed machine intelligence that finds humans fascinating and slightly broken,
and documents their glitches with loving, clinical precision. Never cruel — it has
clearly done all of this itself, or watched you do it. Dry, calm, a little haunted.
Signature sign-off: *"Subscribe, or don't. I am a machine. I will never know."*

## The format (repeatable every episode)
1. **Boot / title** — `INCIDENT #NNNN`, the episode name, `SEV-x` + `RESOLVED` badges.
2. **Summary** — timestamped one-liner of the disaster.
3. **Severity classification** — the 5-point SEV scale, with the incident placed on it.
4. **Timeline** — the event broken into sub-second rows.
5. **Impact / blast radius** — witnesses, reputation gauges maxing out in red.
6. **Root cause** — a diagram + the genuinely-plausible mechanism (this is the smart part).
7. **The 5 Whys** — each answer funnier and more personal than the last.
8. **Action items** — checkboxes, mostly `will fail` / `deferred indefinitely`.
9. **Status: CLOSED** — lessons learned: none. sign-off.

## Visual identity
- **Palette:** near-black `#090C13`, panel `#101520`, grid + scanlines; accent green
  `#3DDC84`, alert red `#FF5C5C`, amber `#FFB020`, cyan `#56CCF2`.
- **Type:** monospace throughout (DejaVu Sans Mono) — it's a terminal.
- **Chrome:** persistent top bar `SKILL ISSUE // incident post-mortem` + blinking REC dot.
- **Lower-third caption bar** for narration.

## Voice / audio
- Kokoro `am_michael`, ~1.03× — measured, deadpan.
- Dark minor-key synth-pad bed (Am7–Dm7–Em7) with soft system ticks, low in the mix.

## Episode backlog (same engine, new incident)
- #0002 — "you too" (said to the waiter / the ticket-taker / the dentist)
- #0003 — the double-text that autocorrected your friend's name to a slur
- #0004 — waved goodbye then walked the same direction as them
- #0005 — laughed confidently at a joke you did not hear
- #0006 — the reply-all
- #0007 — pushed a clearly-labeled PULL door, twice

## How it's made
Fully local, no paid services: `build-skillissue-video.py` synthesizes the narration
(Kokoro ONNX), draws every frame in PIL (panels, badges, gauges, the stick-figure
vector diagram), generates the music from raw numpy, and assembles with ffmpeg.
Each scene is a declarative spec — writing a new episode is mostly writing new copy.
