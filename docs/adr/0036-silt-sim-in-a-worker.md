# 0036 — silt's sim ticks in a worker, over shared memory

- **Status:** Accepted
- **Date:** 2026-08-26
- **Related:** [ADR 0028](0028-silt-simulation-engine.md) (the engine this
  moves off the main thread — its determinism, chunking and clock-guard rules
  are unchanged and still hold), the 120 fps spec
  (`.scratch/silt-120fps/spec.md`) and ticket 02
  (`.scratch/silt-120fps/issues/02-sim-in-a-worker.md`).

## Context

The sim tick is the one frame-path cost with no upper bound — a user can
always pour more sand — and it shared the main thread with rendering and
input. The 120 fps epic's goal is that the page holds the display's refresh
rate regardless; the perf epic (PRs #96–#101) made the tick cheaper, ticket 01
made the blit near-free, and this is the structural step: a heavy world may
degrade the *simulation* rate, never the frame rate.

The engine was built for this (ADR 0028): `src/sim/` is DOM-free,
`Math.random()`-free, and single-buffer — "the buffer is the unit of
transfer". The ticket's reference-machine measurement precondition was
**waived by the repo owner on 2026-08-26** (recorded in the ticket) — the
worker is wanted for the 120 Hz goal regardless of where the Air's ceiling
turned out to be.

## Decision

### SharedArrayBuffer, not per-frame transfer

The grid lives in a `SharedArrayBuffer` both threads view. The worker's `Sim`
runs directly over it (`Grid` now accepts a caller-provided buffer); the main
thread renders from the same bytes every rAF and never owns the world.

Chosen over transferring the `ArrayBuffer` back and forth because transfer
detaches the buffer on each side every frame, has to be choreographed around
paint and save, and breaks the synchronous test seam every `.iwft` suite
stands on. With shared memory the seam reads the live bytes and stays
synchronous.

SAB requires cross-origin isolation: **COOP + COEP on every response**. The
asset audit (2026-08-26) found silt loads no cross-origin assets — no fonts,
no CDN, no external fetches — so the headers block nothing. They are served
in all three environments so every suite runs the mode production runs:

- prod: `src/server/headers.ts` via `createAppServer`'s `registerRoutes` hook
  (a root-scope `onSend`) — app code, not infrastructure;
- dev: `server.headers` / `preview.headers` in `vite.config.ts`;
- CT: `crossOriginIsolated: true` in `playwright-ct.config.ts`
  (`defineIwftConfig`'s new option).

### One core, two hosts — the fallback is live

`SimWorkerCore` (all behaviour, vitest-covered, timer-free) is hosted two
ways behind the `SimHost` seam, selected once at mount by
`selectSimHostKind`:

- **`WorkerSimHost`** — the core in a dedicated worker, ticking on its own
  interval, when the page is cross-origin isolated and has `Worker`.
- **`LocalSimHost`** — the same core on the main thread (plain buffers, same
  code path), when isolation is missing (a stripping proxy, an embed) or
  workers are absent.

This mirrors ticket 01's WebGL/Canvas-2D split: the fallback is exercised by
a dedicated `.iwft`, not dead code. All intent flows through one
`send(SimWorkerMessage)` funnel — there is no second API to keep in step.

### What crosses the wire

- **Paint** batches one message per pointer event: the main thread keeps the
  brush geometry (round footprint, stroke interpolation, the spawner erase
  sweep) and sends flat cell indices. The worker applies them on receipt —
  between ticks, exactly where a main-thread paint landed. The paint "echo"
  is the shared memory itself: the next rAF reads the painted bytes, so the
  round trip is at most a frame and no separate echo layer exists.
- **Spawners** stay entities owned by the page (their chrome is drawn there);
  the worker holds a copy, refreshed on every change, purely for per-tick
  emission — `emitSpawners` before `tick`, spec §7's order, inside the
  worker's loop.
- **`step` / `reset` / `restore`** are messages. `encodeScene` never crosses:
  it reads the shared view main-side (`CellSource` is just
  `{width, height, cells}`).
- **The revision** is published to a shared `Int32Array` status slot with
  `Atomics`, so the renderer's skip-unchanged-world check (ticket 06) costs a
  load, not a message.

### Stances taken

- **Tearing is accepted.** The renderer may read mid-tick bytes; one tick's
  tear on a falling-sand grid was judged invisible by looking (the ticket's
  own suggested test). No double buffer until someone sees it.
- **Hidden tabs pause ticking.** The page forwards `visibilitychange`; the
  worker gates its clock on `running && visible` and drops the debt
  (`FixedTimestep.reset`), matching the old rAF-driven loop where a
  backgrounded tab stopped advancing.
- **The registry is mirrored, not shared.** Both sides build it from the same
  v1 tables; the worker's instance is unreachable and the tables are static.
- **Async paint is invisible to tests** because the seam's consumers already
  poll (`expect.poll` / `toPass` in the POM) — a paint in flight shows up a
  read later.

## Consequences

- The frame rate is no longer hostage to the tick. The main thread's frame
  work is one texture upload and one draw call (ticket 01) plus pointer
  handling.
- ADR 0028's engine rules are untouched — vitest still constructs `Sim`
  headless, determinism tests unchanged. The *integration* moved.
- `useSimLoop` no longer ticks: the host owns the clock; rAF only draws.
- A future app embedding cross-origin content in silt must revisit COEP
  (`credentialless` is the likely escape hatch).
- The Rust/WASM port (deferred, spec §Decisions) composes cleanly: the worker
  would host the WASM module, the byte layout is unchanged.
