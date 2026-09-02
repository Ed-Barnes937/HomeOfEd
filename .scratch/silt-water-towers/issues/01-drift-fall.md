# 01 - Liquid momentum steers the fall (drift-fall)

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md)

Pouring water grows standing towers because a body of water sheds only through
its top surface layer, and the shed cells fall as a curtain that locks the
vertical faces in place (spec, mechanism 2). The validated fix: a liquid that
still has momentum in its `ra` falls diagonally in its parity direction,
spending one momentum per step, instead of straight down.

## Design

- All of it lives in the liquid kernel (`kernels.ts` - `fluid()`), before the
  straight-down `tryMove(0, dy)`. The prototype shape, validated 2026-09-02:

  ```ts
  if (useOpinionField) {
    const packed = api.ra
    const momentum = momentumOf(packed)
    if (packed !== 0 && momentum > 0) {
      const along = parityOf(packed) === 0 ? -1 : 1
      if (api.tryMove(along, dy)) {
        api.ra = packOpinion(parityOf(packed), momentum - 1)
        return
      }
    }
  }
  ```

- Opinion liquids only (`useOpinionField`); gases and lifetime-bearing liquids
  keep the straight fall - the `raIsFree` degrade path (ADR 0038) is
  untouched. `ra` packing unchanged; no new bytes, no new RNG draws.
- Fresh paint has `ra === 0` and interior cells have momentum 0, so the pour
  stream and the piston both still fall straight; only cells whose last act
  was a successful lateral spread (momentum freshly 6) arc outward. That
  selectivity is the design - do not "improve" it by seeding momentum on
  landing without measuring.
- **First, characterise the chunk-sleeping interaction (spec, mechanism 3).**
  A chunk-free engine does not hold the towers at all, so part of the symptom
  may be a sleep/deferral defect the drift masks rather than fixes. Probe
  surface cells with open *lateral* moves that stop being scanned (the
  gravity-move probe from the diagnosis session missed them). If a genuine
  defect falls out, spin it out as ticket 02 rather than widening this one,
  and record the split in the ADR.

## Tests

- A poured column collapses in bounded ticks once the pour stops (pin the
  bound the implementation actually achieves, not the prototype's numbers).
- A solid block on a floor levels in bounded ticks (30x40 -> excess below 5
  well under 300 ticks; prototype reached it by ~t=150).
- A levelled pool still goes completely still - the `scannedLastTick === 0`
  pin in `liquids.test.ts` must hold; drift must not keep settled chunks
  awake.
- Sealed-pocket and mid-fall `canFlow` cases keep passing; determinism test
  unchanged. The whole suite passed unedited under the prototype, so treat
  any assertion that moves as a smell, not a cost.

## Constraints

- ADR 0041 records the decision (Proposed). Flip it to Accepted on landing
  and fill in the measured consequences, including
  `pnpm --filter silt run bench` before/after with `scannedLastTick` beside
  every timing - drift keeps more cells moving, so the cost must be known.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green.
- No archetype changes; the closed set of four stands.

## Comments

- 2026-09-02 - Diagnosed and prototyped in session (see spec for the full
  mechanism and measurements). Demo built as
  `.scratch/silt-water-towers/prototype-drift-fall.html` (local-only): the
  real `src/sim` bundled twice, baseline vs patched, same seed, side by side.
  Ed ran the demo and validated the feel. Status -> ready-for-agent, with the
  chunk-sleeping characterisation as the first step.
- 2026-09-02 - Landed. The chunk-sleeping characterisation ran first and
  found **no defect, so there is no ticket 02**: over 300 ticks of the 30x40
  block, no cell with an open gravity move was ever unscanned and cells with
  open lateral moves went unscanned only as single-tick transients (worst
  streak 1). The engine-vs-chunk-free gap is emergent scan-order/deferral
  behaviour, recorded in ADR 0041 (flipped to Accepted, with the bench
  before/after). The drift branch is the validated prototype shape in
  `fluid()`; new pins in `liquids.test.ts` ("liquid momentum steers the
  fall"): the arc + momentum spend, the spent/blocked straight falls, block
  excess < 5 at t=200 (was 14), pour remnant excess < 8 at pour+200 (was 10,
  now 6). Whole suite, lint, typecheck green; settled worlds still sleep
  (bench scanned=0).
