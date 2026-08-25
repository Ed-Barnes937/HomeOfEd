# Runner prototype — a world moving to the music

Type: prototype
Status: closed
Assignee: ed-barnes937
Blocked by: —

## Question

Can a *procedural* runner deliver the "world moving to the music" feeling
(line rider, Minecraft note-block rides, TrackMania sync) when the music is a
user-made, ever-changing 6×16 pattern? Prototype a character travelling
through a world where terrain, obstacles, and scenery spawn from the
beat-event bus — kick = ground thumps/jumps, snare = obstacles, hats =
scenery ticks, etc. — with the sequencer still editable live.

Answers three things:

1. Is the feeling achievable procedurally at all, or does it only work with
   authored choreography around a fixed song?
2. Is it joyful enough to be V1's reward loop?
3. Scope verdict: pull the world layer into V1 (destination redraw), or ship
   a music-first V1 with light feedback and keep the runner as V2.

Context: raised by the [visualisation prototype](04-visualisation-prototype.md)
verdict — abstract reactive visuals don't carry the loop. Reuse its beat-event
bus and sequencer core from branch `prototype/beat-visuals`.

## Resolution

Prototype built: three world grammars on the locked 6×16 sequencer, on branch
`prototype/beat-runner` — A Beat Runner (flat-ground runner, on-beat
obstacles/scenery), B Hill Rider (terrain is a pure function of the pattern),
C Beat Parade (hazard-free world erupting around a walker).

**Verdict: shelve the reactive element entirely — V1 focuses on the music
interface.** No runner, and no reactive visual layer either; the destination
is redrawn to a music-first V1. The world layer stays a V2 candidate riding
the beat-event seam.

Technical findings worth keeping for that seam (feeds ticket 05):

- **Beat-space sync works**: entities positioned by *arrival tick* and spawned
  a fixed lookahead ahead cross the character exactly when their step sounds;
  tempo changes can't drift it. This is the model a future world layer should
  use.
- Known limit of entity spawning: edits inside the lookahead window sound
  immediately but appear in the world up to a lookahead later. Deriving
  visuals as a *pure function of the pattern* (Hill Rider's terrain) has no
  such lag.
- The monotonic tick counter (never wrapping at the pattern boundary) plus a
  continuous `songPos()` re-anchored on each scheduled beat was the key
  primitive on top of the existing `{ step, audioTime }` bus.
