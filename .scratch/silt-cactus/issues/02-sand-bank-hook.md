# 02 — The sand bank hook

**Status:** done
**Type:** task
**Blocked by:** nothing
**Spec:** [../spec.md](../spec.md) §4

New file `apps/silt/src/sim/sandBank.ts` + `sandBank.test.ts`: the hook the
`duned` species (a seed bedded in sand) will carry. Modelled on `seedBank.ts`
but deliberately simpler — no soak counter, no depth test, no biome fork.

## Behaviour

- Ids passed in (`createSandBank(ids)`), like every hook factory:
  `{ empty, nub, sand }`.
- Cell above is anything but empty (water, plant, stone, the WALL sentinel):
  **dormant and silent** — no draw, no write, no `keepAwake`. The chunk sleeps
  under a roofed bank; a write within 2 cells wakes it when the roof moves.
- Cell above is empty: call `api.keepAwake()` (this hook owns no byte — it is
  the second legitimate customer of the public keep-awake, the evaporation
  precedent, ADR 0044), then draw at `GERMINATE_P = 0.004 / 4` (exported
  constant, same coarse-form idiom as `seedBank.ts`'s).
- On a successful draw: `api.set(0, -1, ids.nub)`,
  `api.witnessGermination(ids.nub)`, then `api.become(ids.sand)` — the bed
  cell is **refunded as sand**: nothing is drunk; the desert's cap is seed
  scarcity, not a moisture ledger.

## Rules

- TDD, mirroring `seedBank.test.ts`'s structure: dormancy under each roof
  kind, silence while dormant (no writes — assert the chunk can sleep),
  keep-awake under open sky, the germination product/refund/witness triple,
  determinism (no `Math.random()`).
- Pure sim module: no DOM, ids injected, no imports from `elements.ts`.
- Do not touch `elements.ts` — wiring the species is ticket 03.
- Run `pnpm --filter silt exec vitest run` (vitest only — do NOT run the
  playwright suite).
- Do not commit; leave changes in the working tree.

## Ambiguity rule

If you hit a genuine design ambiguity this ticket and the spec do not settle,
STOP, put the question under a `## Questions` heading in your final report,
and do not guess.
