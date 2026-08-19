# 07 — Music

**Type:** grilling
**Status:** open
**Blocked by:** —

## Question

The spec asks for calm, spacey background music, switchable off, no chimes.
Decide:

1. **Source**: generative (Tone.js — already the repo's audio dep in boop,
   with its `AudioDriver` seam and fake driver) vs a looped audio file
   (licensing, weight) vs no music at v1 launch with the toggle wired.
2. **The mute pattern**: no HomeOfEd app has a mute/volume control yet — orbi
   establishes it. Persisted preference? Default on or off? (A kid's calm app
   auto-playing music on open vs waiting for a gesture — audio contexts need a
   user gesture anyway, boop's `unlock()` pattern.)
3. Does music react to state (chapter changes, events) or stay ambient?

Run with `/grilling`. Small ticket; may resolve in one short session.

## Answer
