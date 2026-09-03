# 02 - The ember: wood smolders before it flames

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md) §2

Wood should char and glow before it burns, not flash like oil. New pinned
species `EMBER = 18` plus four reaction rows; the smolder phase is what makes
wood read as wood.

## Design

The element (`elements.ts`):

```ts
const ember: ElementDef = {
  id: EMBER, // 18 - pinned, next free after VINE
  name: 'ember',
  colours: ['#b3401d', '#992f14', '#c94d22', '#8a2f16'], // glowing char; tunable
  tags: ['solid'], // NOT flammable - it already is burning
  archetype: { kind: 'static' },
  hardness: 1, // as wood: acid's [solid] rows still reach it
  lifetime: { ticks: 120, jitter: 60, becomes: 'fire' }, // 2-3 s glow, then erupts
}
```

- Four colour shades per the mass rule (`colours[0]` is the base); a creep
  rewrite re-randomises `rb`, so a smoldering mass shimmers slightly - that is
  a feature, note it rather than fighting it.
- Byte ownership is clean: the lifetime countdown owns `ra` (engine-managed),
  variant owns `rb`, static archetype so no opinion-field conflict, and
  180 total is under `MAX_LIFETIME_TICKS = 255`.
- **Not paintable**: `PAINTABLE_IDS` in `paletteGroups.ts` is untouched; add
  ember to its products-stay-out comment.

The rows - placement matters, see the ordering trap in the spec and in
ticket 01:

```ts
{ a: 'fire',  b: 'wood',  p: 0.2,  aBecomes: 'fire',  bBecomes: 'ember' }, // above fire+flammable
{ a: 'lava',  b: 'wood',  p: 0.1,  aBecomes: 'lava',  bBecomes: 'ember' }, // above lava+flammable
{ a: 'ember', b: 'wood',  p: 0.02, aBecomes: 'ember', bBecomes: 'ember' }, // the creep
{ a: 'water', b: 'ember', p: 1,    aBecomes: 'steam', bBecomes: 'wood'  }, // the douse
```

- `fire + wood` restarting the fire cell's countdown (rewrite clears `ra`) is
  today's fuel-keeps-flame-alive behaviour, kept.
- The creep's a-side self-rewrite resets that ember's own countdown: an ember
  with wood still beside it keeps smoldering; it only erupts once its fuel is
  consumed or the p 0.02 draws keep missing. Deliberate - document it at the
  row.
- The douse quenches to wood, mirroring `water + fire` at p 1. Saving a
  smoldering structure by raining on it is the new player verb.
- `acid + wood` (row 5 today) is untouched and must stay above acid's tag
  rows, as its comment already demands - the new rows are fire/lava/ember/water
  keyed, so they cannot steal its pair, but re-read the final ordering anyway.

## Tests

Extend `fire.test.ts` (wedged-pocket style where determinism helps):

- Boot: ember registered at id 18, not flammable, not in the rail
  (`paletteGroups.test.ts` if the rail has a products assertion).
- Fire beside wood produces ember, not fire, on the wood side.
- The creep: a wood beam with one ember cell ends fully ember (or erupted)
  after enough ticks, and never skips through a diagonal-only contact.
- Eruption: a lone ember (no wood contact) becomes fire within 181 ticks, and
  that fire dies to smoke as ever.
- The douse: water beside ember -> steam + wood on the first tick (p 1,
  deterministic in a pocket).
- **Existing tests will move**: `keeps burning while it is touching wood`
  currently asserts `count(WOOD) === 0` after 70 ticks - with the smolder that
  timeline is wrong by design. Rewrite it to assert the new story (wood ->
  ember -> fire over a longer horizon) rather than loosening it until it
  passes.
- `lets lava ignite wood and survive it` similarly now produces ember first;
  update the lit condition (ember or fire) and keep the lava-count assertion.
- Determinism test stays green untouched.

## ADR

Write `docs/adr/NNNN-silt-wood-smolders-as-ember.md` (MADR-lite) covering: the
smolder-as-species model (vs per-cell heat fields or hooks), the
countdown-reset-on-creep call, the douse-to-wood call, and why ember is
neither flammable nor paintable. Ticket 03 extends it with the ash branch.

## Constraints

- Roster + rows + tests + ADR only. No new bytes, no hooks, no `Api` changes.
- A smoldering mass is all-awake by construction (lifetime writes `ra` every
  tick) - run `pnpm --filter silt run bench` before/after and record the
  numbers; a big ember front is expected to cost, the question is how much.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green.
