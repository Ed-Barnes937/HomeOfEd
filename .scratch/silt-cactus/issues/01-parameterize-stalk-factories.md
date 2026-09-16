# 01 — Parameterise the stalk factories

**Status:** done
**Type:** task
**Blocked by:** nothing
**Spec:** [../spec.md](../spec.md) §4

`createSprout` and `createTip` (`apps/silt/src/sim/stalk.ts`) are already
id-parameterised factories, but their tuning lives in module constants
(`STALK_HEIGHT_MIN`, `STALK_HEIGHT_JITTER`, `CLIMB_P`) and the terminal
transition is unconditional bloom. The cactus needs both configurable.

## Scope

1. `createSprout(ids, opts?)` gains `{ heightMin, heightJitter }`, defaulting
   to the current constants — `sproutBudget` reads them.
2. `createTip(ids, opts?)` gains `{ climbP, flowerP }`, defaulting to
   `climbP: CLIMB_P` and `flowerP: 1`. `TipIds` gains an optional `cap`
   species (default: the flower). The terminal branch (budget spent or boxed
   in) draws **once**: `rand() < flowerP` → `ids.flower`, else `ids.cap`.
3. With defaults, the meadow plant's behaviour is **bit-identical** —
   including the RNG draw sequence. Watch this: at `flowerP: 1` do NOT spend a
   `rand()` call on the terminal draw (a spent draw shifts every downstream
   draw and breaks determinism-pinned tests). Only draw when `flowerP < 1`.
4. `witnessBloom()` fires on the terminal transition regardless of which
   product the draw picked (a bloom is a bloom, however it ends). It is
   cursor-read, so a future apex keys its own entry. If you find the witness
   surface genuinely cannot represent the cap outcome sanely, STOP and raise
   it (see the ambiguity rule below) rather than inventing a new witness call.

## Rules

- TDD: extend `stalk.test.ts` first — the new options, the terminal draw
  split, and a pin that defaults leave the existing tests' expectations
  untouched.
- Do not touch `elements.ts` — the meadow wiring stays exactly as it is
  (defaults do the work). No new species in this ticket.
- Keep-awake semantics unchanged: the missed-draw `ra` rewrite stays; the
  terminal cell writes nothing after `become`.
- Run `pnpm --filter silt exec vitest run` (vitest only — do NOT run the
  playwright suite; the orchestrator runs the full suite at the end).
- Do not commit; leave changes in the working tree.

## Ambiguity rule

If you hit a genuine design ambiguity this ticket and the spec do not settle,
STOP, put the question under a `## Questions` heading in your final report,
and do not guess.
