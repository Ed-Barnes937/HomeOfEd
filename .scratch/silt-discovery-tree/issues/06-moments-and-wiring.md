# 06 - Moments + end-to-end wiring

**Status:** done (built on silt-interaction-tree, 2026-09-04)
**Type:** task
**Blocked by:** 02, 03, 04, 05
**Spec:** [../spec.md](../spec.md) §3, §6 "Moments"

Close the loop: sim first-witness -> store -> header tick, panel live update,
moment cards, and the mud unlock arriving in the rail - while the world keeps
running.

## Design

- Subscribe the page to ticket 02's first-witness callback; feed ticket 03's
  store; everything downstream re-derives.
- **Moment card** (one component, two contents), bottom-left over the canvas
  opposite the run pill: rise ~400ms, hold ~2.5s, fade. Discovery: tile +
  "new entry" + element name (edge-only discoveries where no new element
  appears: name the interaction instead). Mastery unlock: tile + "mud - 5 of
  5" + "mud joins your rail", and the EARNED control appears (ticket 04).
  Queue, don't stack: a burst of firsts (a big splash) shows one card at a
  time and may collapse the backlog to the newest few - quiet beats complete.
- **Spoiler rule holds here too**: a discovery card may name the discovered
  element (it is discovered the instant the card exists); it must not name
  still-hidden products of the same edge... which cannot happen (witnessing
  the edge discovers its products) - assert that reasoning with a test, not
  a comment.
- **100% moment**: when the 37th entry lands, one line over the world in the
  first-visit hint's own type, once ever (a flag derived from the store -
  full set present - shown only at the transition, not on later loads).
- If the panel is open when a first arrives, the new row/spoke appears in
  place (React re-render off the store; no special path).
- This ticket owns the final determinism + perf sanity pass for the whole
  epic: determinism test green, bench eyeballed, and the drift test green on
  the branch.

## Tests

- iwft, the whole loop as a user: paint water onto lava -> moment card
  appears naming steam/obsidian -> header count ticks -> open panel, edge is
  lit. (Deterministic seed; the sandspiel/burnables iwfts have the paint-and-
  settle patterns.)
- iwft: seed the store with 4 of mud's 5 edges, witness the 5th in-sim ->
  unlock card + EARNED control appears without reload.
- Unit: card queue collapses a burst; 100% fires exactly once.
