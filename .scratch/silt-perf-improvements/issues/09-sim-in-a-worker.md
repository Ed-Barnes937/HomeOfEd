# 09 — Move the sim off the main thread (proposal)

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md)

**This one needs a human decision before anyone starts.** It is an ADR-level
change, it touches the seam every other part of silt is built against, and it
is worth more than tickets 02–08 put together on a slow machine. It is filed
here so the option is on the record, not because it is scheduled.

## The argument for

Everything else in this audit makes the sim *cheaper*. This makes it *not the
main thread's problem*. On a 2018 MacBook Air the frame budget is shared
between the tick, the rasterise, the blit, React's reconcile and the pointer
handlers, and the tick is the part with no upper bound — a user can always pour
more sand. Moving it to a worker means a heavy world degrades the *simulation*
rate while the UI stays at 60 fps, instead of the whole page juddering.

The engine was built for this. From `grid.ts`:

> The buffer is the unit of transfer, so moving the sim into a worker is a
> `postMessage`, not a restructure.

`src/sim/` is already DOM-free and has no `Math.random()`. The seam is already
narrow — `renderer.ts` declares `RenderableSim` as exactly
`{ width, height, cells }`.

## What it would actually cost

The honest list, because the comment above understates it:

- **`Sim.paint` is synchronous and the UI calls it per brush cell per pointer
  event.** Across a worker boundary that becomes a message, and the round trip
  is longer than a frame. Painting would have to be batched per event, and the
  local echo — the user expects to see paint appear under the pointer
  immediately — needs designing.
- **`SharedArrayBuffer` needs cross-origin isolation** (COOP/COEP headers),
  which is a Fly/Cloudflare change and would break any cross-origin asset.
  Without it, the alternative is transferring the `ArrayBuffer` back and forth
  each frame, which detaches it on both sides and has to be choreographed.
- **The test seam** (`TEST_SEAM_KEY`, `speciesAt`, `countSpecies`) is
  synchronous and every `.iwft` suite is built on it.
- **`saveScene`/`loadScene`** read and write the grid synchronously through
  `encodeScene`/`Sim.restore`.
- **Determinism must survive**, and the tests that assert it currently
  construct a `Sim` directly in Vitest. They would keep doing so — the engine
  stays testable headless — but the *integration* is what changes.

## What a decision needs

1. Is the current cost, after tickets 02–08 land, actually short of 60 fps on
   the reference machine? **Nobody has measured silt on it.** That measurement
   is the precondition for this ticket, and it may close it.
2. If it is short: `SharedArrayBuffer` + cross-origin isolation, or transfer?
   That is the fork, and it decides most of the rest.
3. An ADR under `docs/adr/`, since `docs/adr/0028-silt-simulation-engine.md`
   currently describes a same-thread engine.

**Recommendation:** do not start this until tickets 02–08 have landed and
someone has run silt on the reference machine with a busy world. It may well be
unnecessary, and it is the kind of change that is much harder to undo than to
do.
