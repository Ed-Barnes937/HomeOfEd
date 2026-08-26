# 02 — Move the sim into a worker

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 01

Move the tick off the main thread. A heavy world then degrades the
*simulation* rate while the page holds the display's refresh rate — the tick
is the one frame-path cost with no upper bound (a user can always pour more
sand), and this makes it not the main thread's problem. This is the likeliest
single unlock for the spec's goal.

This continues the perf audit's ticket 09
(`.scratch/silt-perf-improvements/issues/09-sim-in-a-worker.md`, on the
`silt-perf-improvements` branch until that epic merges), which filed the option
and its honest cost list. What has changed since: the decision to pursue the
120 fps goal was taken (this epic), and the Rust port it was weighed against
was deferred — see the spec's Decisions section. What has *not* changed:
ticket 09's precondition. **Measure a busy world on the reference machine
(2018 MacBook Air) with the perf-epic PRs and ticket 01 landed, before
starting.** If that machine already holds 60 fps with a churning world, this
ticket shrinks to a 120 Hz-only concern.

The engine was built for this: `src/sim/` is DOM-free, `Math.random()`-free,
and single-buffer — `grid.ts`: "the buffer is the unit of transfer, so moving
the sim into a worker is a `postMessage`, not a restructure."

## The fork to decide first (why this is needs-triage)

**`SharedArrayBuffer` vs transfer.** SAB lets the main thread's render loop
read the live grid with no copies and no choreography — but requires
cross-origin isolation (COOP/COEP headers), which is a Fly/Cloudflare change
(**human-gated** per `CLAUDE.md` — infrastructure), and those headers break
any cross-origin asset the page loads. The alternative is transferring the
`ArrayBuffer` back and forth each frame, which detaches it on both sides and
has to be choreographed around paint and save. SAB is the recommendation if
the header audit comes back clean; the choice decides most of the design
below, and it needs the human.

## Design outline (SAB variant)

- Worker owns `Sim` and the fixed-timestep loop; ticks at 60/s regardless of
  main-thread rAF. Main thread keeps rAF and, each frame, uploads the shared
  grid bytes to the WebGL texture from ticket 01. Tearing (rendering a
  mid-tick frame) needs a stance: double-buffer in the worker, or accept it —
  one tick's tear on a falling-sand grid may be invisible. Decide by looking.
- **Painting**: `Sim.paint` is currently synchronous per brush cell per
  pointer event. Batch per event into one message; the round trip is longer
  than a frame, so the local echo (paint must appear under the pointer
  immediately) needs designing — likely paint applied worker-side next tick
  plus the brush outline as the echo, but this is a feel call to prototype.
- **The test seam** (`TEST_SEAM_KEY`: `speciesAt`, `countSpecies`) is
  synchronous and every `.iwft` suite stands on it. With SAB it can read the
  shared bytes directly and stay synchronous — this is a strong argument for
  SAB on its own.
- **`saveScene` / `loadScene` / `step` / `reset`** become messages;
  `encodeScene` can read the SAB view main-side. A load enters paused (already
  the rule), which sidesteps most races.
- **Determinism is unchanged**: the engine still constructs headless in
  vitest; what changes is the integration, and the emission order
  (`emitSpawners` before `tick`, per spec §7) must move into the worker loop
  intact.

## What lands with it

- **An ADR.** ADR 0028 describes a same-thread engine; this changes the
  architecture it documents. Threading model, the SAB decision, and the paint
  echo design belong in `docs/adr/`.
- The reference-machine measurement recorded under `## Answer`, whichever way
  it points.
- If SAB: the COOP/COEP header change handed to the human with a runbook note,
  and verified against every asset origin the app touches.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green,
  determinism tests included.
