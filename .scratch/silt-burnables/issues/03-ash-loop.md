# 03 - The ash loop: burn -> ash -> mud -> regrowth

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 02
**Spec:** [../spec.md](../spec.md) §3

Burning should leave something behind, and that something should feed the
plant cycle: ash falls, rain turns it to mud, and the existing
`seed + mud -> moss` row regrows what burned.

## Design

The element (`elements.ts`):

```ts
const ash: ElementDef = {
  id: ASH, // 19 - pinned
  name: 'ash',
  colours: ['#9b948b', '#8c867d', '#a7a096', '#948d84'], // pale grey; tunable
  tags: ['powder'], // NOT flammable - it is what already burned
  archetype: { kind: 'powder', density: 35, slide: 1 },
  hardness: 0,
}
```

- Density 35: sinks through water (30) so it reaches the ground to be wetted,
  cannot displace mud (50) so it rests on a wetted bed, and sand (60) and seed
  (40) both sink past it.
- **Not paintable** - a product; `PAINTABLE_IDS` untouched, comment updated.
- Acid's `[powder]` row at `maxHardness: 1` covers it: acid dissolves ash.
  Fine - nothing to do, but note it in a test so it is a choice, not a
  surprise.

The rows:

```ts
{ a: 'fire',  b: 'ember', p: 0.05, aBecomes: 'fire', bBecomes: 'ash' },
{ a: 'water', b: 'ash',   p: 0.4,  aBecomes: null,   bBecomes: 'mud' },
```

- `fire + ember` is the probabilistic branch that `lifetime.becomes`
  (single-valued) cannot express: most embers erupt to flame, some are burned
  down to residue by the open fire beside them. No other row covers the pair
  (ember is not flammable), so placement is free - keep it beside the other
  fire rows for legibility.
- `water + ash` mirrors the `water + dirt` row shape exactly: the water is
  spent (a-side null), the ash becomes the bed. Same p as wetting dirt.
- The loop then closes through rows that already exist: `seed + mud -> moss`.

## Tests

- Boot: ash at id 19, powder, not flammable, not in the rail.
- The branch: a wood block torched under sustained fire ends with
  `count(ASH) > 0` under a fixed seed - burning leaves residue.
- Wet ash: water beside ash in a pocket -> mud appears, water is consumed
  (statistical at p 0.4; run enough ticks or use several pairs).
- The full loop as one integration case: ash bed + water rained on it + a seed
  dropped -> moss exists within N ticks. This is the payoff; it exercises no
  new mechanism, so one loose end-to-end assertion is enough - do not re-test
  `seed + mud` here.
- Density sanity: ash sinks through water, rests on mud (unit-level via
  `canDisplace` or a two-cell sim case).

## ADR

Extend ticket 02's ADR with the ash branch: why the residue comes off the
`fire + ember` pair rather than a second ember species or a lifetime branch,
and the ash-to-mud fertility call.

## Constraints

- Roster + rows + tests + ADR edit only. No engine changes.
- Expected ash yield is a tuning question (ticket 04 owns it) - assert
  presence, not quantity.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green.
