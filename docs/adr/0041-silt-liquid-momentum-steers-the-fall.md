# 0041 - silt: liquid momentum steers the fall

- **Status:** Accepted (2026-09-02, landed with
  `.scratch/silt-water-towers/issues/01-drift-fall.md`)
- **Date:** 2026-09-02
- **Related:** `.scratch/silt-water-towers/spec.md` (the tower diagnosis) and
  ticket 01 there;
  [ADR 0038](0038-silt-liquids-keep-their-direction-in-ra.md), whose `ra`
  packing this reuses; [ADR 0028](0028-silt-simulation-engine.md) for the
  engine. Implemented in `apps/silt/src/sim/kernels.ts`.

## Context

Pouring a lot of water in one spot grows a standing block with vertical faces
that outlives the pour by hundreds of ticks. The diagnosis (spec above,
measured): a body of water sheds cells only through its top surface layer, at
a rate independent of the body's size, and the shed cells fall as a one-cell
curtain hugging the faces - keeping every face cell's down-diagonal blocked,
so the faces cannot erode. Pour inflow beats the shed rate, and the block
grows for as long as the pour runs.

The opinion field is not the cause - the pre-epic coin-flip lateral towers
identically. Sandspiel's water kernel is structurally ours and towers for the
same reason in isolation; what breaks its towers up is the Navier-Stokes wind
field that runs before its CA pass, which the sandspiel teardown ruled out of
scope for silt.

The kernel already stores a lateral direction and a momentum counter in `ra`
(ADR 0038), but momentum today only meters how long a blocked cell presses on
before turning around. A cell falling off a plateau edge forgets, in effect,
that it was just moving sideways at speed.

## Decision

A liquid that owns its `ra` and still has momentum falls **diagonally in its
parity direction**, spending one momentum per step, and only falls straight
once momentum is spent (or when the diagonal is blocked). The check sits
before the straight-down step in `fluid()`; the `ra` packing is unchanged and
no new randomness is drawn.

What makes this selective is who carries momentum: fresh paint has `ra = 0`
and settled interiors have momentum 0, so the nozzle stream and the falling
piston are untouched. The only cells that arc are those whose last act was a
successful lateral spread - exactly the cells stripped off a plateau's top
layer. They are thrown clear of the face in a 45-degree arc instead of
curtaining down it, the face diagonals come open, and the block sheds from
three surfaces instead of one.

Opinion liquids only: gases never organise a current (ADR 0038 already
excludes them), and a liquid with a `lifetime` keeps degrading to the plain
kernel via the `raIsFree` gate - its `ra` is a countdown, not an opinion.

## Consequences

Measured on landing (headless probes over the real `src/sim`, seed 1):

- Post-pour remnant tower at settle (pour+200): excess 6, matching the
  prototype's 18 -> 6; the landing probe's shorter 150-tick pour measures
  10 -> 6 on the same seed. The standing plateau at pour end is gone; what
  remains is the physically saturated in-flight stream, spray, and a low
  cone.
- A 30x40 solid block on a floor: excess at t=100 21 -> 10, at t=150 18 -> 5,
  at t=200 14 -> 3. Both scenarios are pinned in `liquids.test.ts`
  ("liquid momentum steers the fall"): block excess < 5 at t=200, pour
  remnant excess < 8 at pour+200.
- The whole silt vitest suite passed unedited - the levelled-pool-goes-still
  pin, sealed pocket, mid-fall and determinism cases included. `tryMove`
  draws no randomness, so the drift branch consumes nothing extra from the
  RNG stream on success and the stream only shifts where a fall outcome
  changes.
- Bench before -> after (`pnpm --filter silt run bench`, ms/tick with
  `scannedLastTick` beside it): spawners + mixed world 0.572/5840 ->
  0.556/7093; reaction churn 0.634/1872 -> 0.619/1747; plant growth
  0.695/5719 -> 0.720/6226; settled world 0.005/0 -> 0.002/0. The cost is
  where it was expected - scan pressure in wet worlds (+21% scanned in the
  pouring scenario) - while ms/tick stays within run-to-run noise, and a
  settled world still sleeps completely.
- The chunk-sleeping open question is closed with **no defect and no split
  ticket**. The probe (300 ticks over the 30x40 block, scanned-ness read from
  the per-cell clock byte): no water cell with an open gravity move ever went
  unscanned, and cells with an open *lateral* move went unscanned only as
  single-tick transients (worst streak: 1 tick) - the block is fully scanned
  every tick while it holds. The engine-vs-chunk-free gap in the diagnosis is
  therefore emergent from designed behaviour (chunk-by-chunk scan order and
  the deferred cross-chunk move queue), not from cells being wrongly put to
  sleep: repositioning the same block relative to chunk boundaries moves the
  levelling curve markedly (a block aligned inside one chunk column levels
  *slowest*; one centred on a boundary fastest), which scan order explains
  and a sleeping defect would not.
