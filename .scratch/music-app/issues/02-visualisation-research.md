# Rhythm visualisation research

Type: research
Status: resolved
Blocked by: —

## Question

Survey the prior art in beat-synced, kid-appealing visuals to inform our
abstract visualisation: Chrome Music Lab (Song Maker, Rhythm, Kandinsky),
Patatap, Blob Opera, and notable generative/audio-reactive approaches on the
web. For each: what makes the visuals feel joyful vs clinical, how visuals map
to musical events (per-instrument personality? colour? physics?), and what
rendering tech they use (Canvas/SVG/WebGL). Distil into principles and 2–3
candidate visual directions we could prototype.

Findings land on branch `research/rhythm-visualisation` as a markdown file.

## Answer

Full findings: branch `research/rhythm-visualisation`, commit `6906e80`, file
`.scratch/music-app/research/rhythm-visualisation.md` (committed with `git
add -f` — `.scratch` is gitignored).

Surveyed Song Maker, Rhythm, Kandinsky, Patatap, Blob Opera, Groove Pizza,
Seaquence, Incredibox, plus Rayman Legends' music-level sync as the
character-layer reference.

**Cross-cutting principle:** joy comes from giving every beat event a "body" —
spring/squash physics, one visual personality per instrument, meaningful
colour. Visuals should subscribe to the audio engine's **quantised beat-event
bus**, never to audio analysis.

**Candidate directions (all consume the same beat-event stream, so choosing
later doesn't fork the audio engine):**

1. **Bouncy Shapes** — abstract Patatap/Kandinsky stage; one bold shape family
   per track, spring-physics squash on each hit. Cheapest prototype (Canvas 2D).
2. **Groove Garden/Aquarium** — Seaquence-style: each track is a creature whose
   anatomy is shaped by its step pattern, pulsing on hits with a bar-sweep
   ripple. Strongest "tweak → respond" loop; grows best toward the
   Rayman-style character/world layer.
3. **Rhythm Necklace Stage** — Groove Pizza concentric rings, glowing rhythm
   polygons, popping beads, bouncing central face. Most legible, weakest path
   to a world layer.
