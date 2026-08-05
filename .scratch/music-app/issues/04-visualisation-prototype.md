# Visualisation prototype

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

Is the reward loop actually rewarding? Prototype beat-events driving abstract
visuals (per the candidate directions from the visualisation research): shapes,
colour and motion reacting to a playing pattern, with per-instrument visual
personality. Answers: does *tweak the music → watch the visual respond* deliver
enough joy to carry the app, and which visual direction to commit to in the
spec.

## Answer

**No — none of the three abstract directions carries the reward loop.** All
three variants (Bouncy Shapes, Groove Garden, Rhythm Necklace) were built on
the locked 6×16 sequencer, driven by one quantised beat-event bus with
immediate audition, spring physics, and per-instrument personality — the full
recipe from the research. The user's reaction: this is "SVGs pulsing"; the
feeling they actually want is **a world moving to the music** — line-rider
videos, Minecraft note-block rides, TrackMania sync.

Key insight: those references are *authored* choreography around a fixed
song. With user-made, ever-changing patterns the visual can only be
*procedural* — the closest match is a runner whose terrain/obstacles/scenery
spawn from beat events, i.e. the Rayman character/world layer currently out
of scope. Whether that's achievable and joyful enough to pull into V1 is now
its own prototype ticket ([09](09-runner-prototype.md)); its outcome decides
V1's visual scope and may redraw the destination.

Also validated regardless of direction: the beat-event bus (`{ step, hits }`
via Tone.Draw, no DOM/canvas work in the scheduler callback, immediate
audition on toggle) worked cleanly for three very different consumers — good
evidence for the seam ticket 05 will formalise.

Prototype captured on branch `prototype/beat-visuals`
(`.scratch/music-app/prototype-visualisation/index.html`).
