# 03 - The ash loop: burn -> ash -> mud -> regrowth

**Status:** done
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

## Answer

Landed as specified. `ASH = 19` is a powder, `tags: ['powder']` (no
`flammable`), `{ kind: 'powder', density: 35, slide: 1 }`, hardness 0, no
lifetime. Both rows are in: `fire + ember, p 0.05 -> fire + ash` sits with the
fire rows just *below* `fire + flammable` (ember carries no tag, so nothing
claims the pair and the position is free - below rather than above so it does
not read as a rung of the ignition ladder), and `water + ash, p 0.4 ->
(spent) + mud` sits immediately beside `water + dirt`, the row it mirrors.
`PAINTABLE_IDS` is untouched; only its comment gained ash.

**Three things worth knowing.**

1. **The branch keeps a walled-in flame alive, and that broke a ticket-02
   assertion.** `aBecomes: 'fire'` rewrites the fire cell, and a rewrite clears
   `ra`, so a fire beside an ember restarts its countdown every time the 0.05
   draw lands - the same mechanism as `ember + wood` resetting the ember's
   countdown and as the whole ignition ladder resetting fire's. On the 20x13
   wall, `smolders through a wall of wood rather than detonating it` asserted
   `count(FIRE) === 0` at tick 70 ("nothing re-lit it - char is not fuel"); the
   flame now lives from tick 1 to tick 133, so that line is now `=== 1`, which
   says both halves of the truth: it never spread (ember is not flammable) and
   it never went out (the branch feeds it). Its companion `flamed` flag was
   vacuous once fire never hits zero, so it became a peak-fire count asserting
   `> 1` - i.e. the eruptions really do arrive. Rewritten, not loosened, and
   ADR 0042's consequences now carry the new measurements. Char is fuel *to an
   existing flame* while still not being `flammable`: the tag governs ignition,
   this row governs consumption.
2. **The colours follow the mass rule, not the ticket's literal array** - the
   same call ticket 02 made for ember. The ticket's base `#9b948b` is kept and
   the other three derived at x0.90/x1.08/x0.96 (ADR 0040 §3), giving
   `['#9b948b', '#8c857d', '#a7a096', '#958e85']`; the ticket's array differed
   from the rule in two channels of twelve. Ticket 04 tunes the base and the
   rule re-derives the rest.
3. **Density is pinned through `canDisplace`, not through a fall.** A shaft of
   water is the obvious sim case for "ash sinks through water", but the wetting
   row fires on the way down, so the sim is a poor instrument for the density
   question. `canDisplace` covers ash-over-water, ash-under-mud and
   sand/seed-over-ash; a separate two-cell sim case covers "rests on a bed of
   mud" (no water in it).

Tests in the new `apps/silt/src/sim/ash.test.ts` (9 cases):

- boot pin: id 19, `['powder']`, not flammable, the archetype, hardness 0, no
  lifetime, four shades. Rail absence is asserted in `paletteGroups.test.ts`,
  as ember's is.
- registry pins for both rows, both ways round, plus `p` equality with
  `water + dirt`. Registry-level rather than only a declared-order slice,
  because a slice can be "fixed" by editing the slice.
- `acid + ash` pinned as two-in-none-out via the `[powder]` row at
  `maxHardness: 1`, so acid erasing a bed of ash reads as a choice.
- the density set (`canDisplace`) and the rests-on-mud sim case.
- the branch: the same 20x13 wall, 600 ticks, all wood gone, ash present and
  fewer cells than the wall started with - i.e. residue is not the only ending,
  some of the block goes up as smoke. Measured on seeds 1-5: first ash at ticks
  3-14, 118-141 of 260 cells end as residue.
- wetting: the same poured-bed arrangement `soil.test.ts` wets dirt in, with
  ash for the dirt - 200 ticks, mud appears and the water is spent one for one
  (44 cells of water -> 44 of mud).
- the loop, end to end: rain on an ash bed with a seed dropped in. First mud at
  tick 5, first moss at tick 12 (seeds 1-5 agree within a tick). One loose
  assertion plus "mud exists", since nothing else in that world makes mud, and
  no re-test of `seed + mud`.

The four declared-order pins were slid along by the two inserted rows
(`fire.test.ts` 1-13 -> 1-14, `acid.test.ts` 1-18 -> 1-19, `soil.test.ts`
1-21 -> 1-23, `life.test.ts`' full table) - mechanical, no intent changed. The
`sceneRoundTrip.test.ts` fixture at `id: 20` was left alone: 19 does not
collide. Nothing outside roster + rows + tests + docs was touched; no engine
change was needed.

**ADR: [0042](../../../docs/adr/0042-silt-wood-smolders-as-ember.md) §6**
(extended, not replaced) - why the residue hangs off `fire + ember` rather than
off a second char species (a roster slot plus a full set of rows, all of which
have to answer the creep and the douse again) or off ember's own lifetime
(which would invert which outcome is common: every ember ends as ash on a
schedule and open flame becomes the accident), the fire-side rewrite above, and
the ash-to-mud fertility call - `water + dirt` with the bed swapped, because
otherwise the world gains a one-way sink, which is the opposite of silt's
register. The consequences section now carries the corrected wall timeline.

**Feel notes for ticket 04:**

- **Yield is high**: roughly half a torched wall (126 of 260 cells) ends as ash.
- **0.05 does not mean "5% of embers"**, and this is the one thing in the
  ticket whose *prose* does not survive contact with the arithmetic. The draw
  is per tick and an ember glows for 120-180 ticks, so an ember held against
  open flame for its whole life becomes ash all but certainly - the per-contact
  "most flame, some ash" fork is not a fork. What keeps flame the common ending
  is geometry: the creep front runs away from the cell that lit it, so most
  embers never touch a flame at all, and 48% is what falls out. `p` is still the
  lever on that mix, but if the wanted story is "an ember beside a flame usually
  still erupts", that is a `p` nearer 0.001. Recorded in ADR 0042's
  consequences and in `ash.test.ts`; left at the ticket's 0.05 because the row
  is specified verbatim and ticket 04 owns the number.
- **The wall takes longer to finish** - last wood at tick 180 and last ember at
  ~340, against ticket 02's 232 - because the branch feeds the flame that is
  charring it.

**Bench** (`pnpm --filter silt run bench`, three runs): churn 0.680-0.711
ms/tick at **scanned=3399**, against ticket 02's 0.678-0.694 at 2184. Half
again as many cells awake for no measurable per-tick change - the extra cells
are the longer-lived flames and ash grains sitting in notches they cannot leave
(ADR 0039 keeps those awake). The other three scenarios are untouched,
`scannedLastTick` included: mixed world 7093, plant growth 6226, settled world
0 at 0.002 ms/tick.

**Two files outside "roster + rows + tests + ADR"**, both judged worth it:
`apps/silt/CLAUDE.md` (the roster line and the wood/ember sentence - the root
CLAUDE.md's verify list asks for a current scoped CLAUDE.md, and ticket 02 did
the same), and **ADR 0040 §3**, whose "fourteen of the seventeen elements
declare four shades" was left stale by ticket 02 and would have been staler
here. It now states the rule and notes the count moves with the roster.

**Code review** (`/code-review` against HEAD, both axes) found no hard
standards violation and nothing missing from the spec. Five findings were
acted on: a factually wrong colour comment ("palest matter in the roster" -
sand and sulphur are lighter), the undocumented **density tie with acid at 35**
(ash floats on an acid pool rather than sinking; moot, since acid's `[powder]`
row dissolves it on contact - now said in the roster comment), a `pour`
docstring pointing at `soil.test.ts` when the body came from `acid.test.ts`, a
tautological `p < 0.5` assertion (deleted, and its comment replaced by the
per-tick reading above), and ADR 0040's stale count. Two findings were noted
and left: the four declared-order prefix pins rippling on every inserted row
(the repo's documented pattern - `acid.test.ts` says so in a comment), and ADR
0042 now carrying ash as well as ember (the ticket asked for an extension, not
a new ADR).
