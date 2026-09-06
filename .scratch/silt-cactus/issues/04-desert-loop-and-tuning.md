# 04 — The desert loop, measured

**Status:** done
**Type:** task
**Blocked by:** 03
**Spec:** [../spec.md](../spec.md) §5

The integration test in `life.test.ts`'s idiom: prove the loop closes and pin
the band, so tuning is a measurement rather than a feeling.

## Scope

1. A `the desert loop` describe block (new file `desert.test.ts` or alongside
   `life.test.ts` — follow whichever reads better in that suite's structure):
   - **The loop closes**: a seed on a sand bed, run long enough, produces
     `duned → nub → apex → cactus` column cells, and (over several seeds /
     enough ticks) at least one `blossom` whose death leaves a falling seed.
   - **Fire cannot clear a desert**: fire played over a standing cactus leaves
     the column (steam rows) and the bank (`duned` not flammable) intact.
   - **The rot race**: on stone (no bed), a loose seed still rots to nothing.
   - **The hanging-blossom invariant**: assert flesh min lifetime in ticks
     (6400) clears blossom max (2400) by construction — a registry-level pin,
     like the stalk/flower one if it exists; write it the same way.
2. **Measure the band** over seeds 1–6 on a reference sand bed (pick a bed
   size and document it in the test, as `life.test.ts` documents its 261-cell
   bed): standing cactus count at a settled tick. Record the measured band in
   the test's comments and pin a generous envelope, not the exact numbers —
   the meadow suite's style.
3. If the measurement says the desert reads as a hedge (columns shoulder to
   shoulder) or as barren (no established cactus from six seeds in a
   reasonable horizon), do NOT invent a fix — STOP and report the numbers as a
   question. Tuning knobs are Ed's call per spec §5.

## Rules

- Deterministic: seeded runs, no timing.
- Run `pnpm --filter silt exec vitest run` (do NOT run the playwright suite).
- Do not commit; leave changes in the working tree.

## Ambiguity rule

If you hit a genuine design ambiguity this ticket and the spec do not settle,
STOP, put the question under a `## Questions` heading in your final report,
and do not guess.
