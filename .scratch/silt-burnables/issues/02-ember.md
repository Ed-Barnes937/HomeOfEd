# 02 - The ember: wood smolders before it flames

**Status:** done
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

## Answer

Landed as specified. `EMBER = 18` is a static solid, `tags: ['solid']`,
hardness 1, `lifetime: { ticks: 120, jitter: 60, becomes: 'fire' }`, and all
four rows sit where the ticket puts them: `fire + wood` at the tail of the
ignition ladder above `fire + flammable`, `lava + wood` above
`lava + flammable`, then the creep and the douse (neither of which any tag row
claims, since ember carries no `flammable` tag and the acid rows are
acid-keyed). `acid + wood` is untouched and still above acid's tag rows -
re-read, and `acid.test.ts`' order pin now covers rows 1-18. `PAINTABLE_IDS` is
untouched; only its comment gained ember.

**Two deviations, both small.**

1. **The colours are the mass rule's, not the ticket's literal array.** The
   ticket gave `['#b3401d', '#992f14', '#c94d22', '#8a2f16']` marked "tunable"
   while its prose asked for "four colour shades per the mass rule". Those two
   disagree: every one of the roster's fourteen mass elements is exactly its
   base at ×1.00/×0.90/×1.08/×0.96 (ADR 0040 §3), and the ticket's array is not.
   Kept the ticket's base and derived the other three by the rule, giving
   `['#b3401d', '#a13a1a', '#c1451f', '#ac3d1c']`. Ticket 04 can tune the base;
   the rule then re-derives the rest. Worth knowing that this makes the "a
   creep rewrite re-randomises `rb`, so the mass shimmers" effect *subtler*
   than the ticket's wider spread would have - ±10% of luminance is the whole
   point of the rule, so if the shimmer wants to be visible that is a tuning
   conversation about the rule, not about ember.
2. **One file outside "roster + rows + tests + ADR"**:
   `sceneRoundTrip.test.ts` had a throwaway fixture element *named* `ember`,
   and the registry refuses a duplicate name, so it is now `decay`. Forced, not
   chosen. It keeps `id: 20`, which does not collide with ticket 03's
   `ASH = 19` - but the species after ash would, so **ticket 03 should either
   take an id below 20 or move that fixture**.

Tests in `fire.test.ts` (plus the rail assertion in `paletteGroups.test.ts`):

- boot pin (id 18, `['solid']`, not flammable, hardness 1, the resolved
  lifetime, static, four shades) and the rail-absence assertion.
- `chars the wood it touches rather than lighting it`: over 40 seeds of a
  wedged pocket the wood side is never fire - 11 of the 40 char on the first
  tick, the rest stay wood.
- `creeps along a wood beam through orthogonal contacts only`: over all 40
  seeds, 100 ticks (under ember's own 120-tick floor, so this window sees the
  creep row and nothing else) leaves a contiguous run of 2-10 embers from the
  lit end, no fire, and the diagonal-only cell still wood - that last one as an
  invariant, since `applyReactions` counts orthogonal contacts only. Then 700
  more ticks and the beam holds no wood at all; the slowest seed clears at
  tick 423.
- eruption: a lone ember becomes fire between ticks 120 and 180 (never
  earlier), and that fire dies to smoke on fire's own schedule.
- the douse: `water + ember` in a pocket is steam + wood on the first tick.
- `keeps burning while it is touching wood` **rewritten**, not loosened, as
  `smolders through a wall of wood rather than detonating it`. The old
  assertion (`count(WOOD) === 0` at 70 ticks) is wrong by design now. Measured
  on the same 20×13 wall: the fire chars its four contacts, is dead to smoke by
  tick 55 (nothing re-lights it - char is not fuel), 102 of 260 cells glow at
  tick 70 with 157 still wood, the first eruption lands at tick 128, and the
  last wood is gone at tick 232. The test pins the shape of that, not the exact
  ticks.
- `lets lava ignite wood and survive it`: lit condition widened to fire *or*
  ember, lava-count assertion untouched.
- a registry-level pin that `reactionFor(FIRE, WOOD)` and
  `reactionFor(LAVA, WOOD)` both produce ember, and the symmetric pair from the
  wood side. This is the assertion that actually fails on a reorder - a
  declared-order slice can be "fixed" by editing the slice.
- the ticket-01 ladder test lost its `p(WOOD) === tagRow.p` line (wood has its
  own row now) and was renamed to what it still checks: the ranks.
- determinism test green untouched. The three other order pins
  (`acid.test.ts`, `soil.test.ts`, `life.test.ts`) were slid along.

**ADR: [0042](../../../docs/adr/0042-silt-wood-smolders-as-ember.md)** -
smolder-as-species (against a per-cell heat field, which needs a byte there
isn't, and against a hook, which is for what a row cannot express),
countdown-reset-on-creep, douse-to-wood, and why ember is neither flammable
(the tag is what every ignition row keys on, so leaving it off *is* the
enforcement) nor paintable.

**Bench** (`pnpm --filter silt run bench`, three runs each side):

| scenario               | before                            | after                     |
| ---------------------- | --------------------------------- | ------------------------- |
| spawners + mixed world | 0.570-0.572 ms/tick, scanned 7093 | 0.571-0.582, scanned 7093 |
| reaction churn         | 0.628-0.636 ms/tick, scanned 1749 | 0.678-0.694, scanned 2184 |
| plant growth           | 0.731-0.744 ms/tick, scanned 6226 | 0.787-0.810, scanned 6226 |
| settled world          | 0.002 ms/tick, scanned 0          | 0.002, scanned 0          |

Reaction churn is the row that means anything: it holds a 240-cell wood slab
under two fire spawners, and the slab that used to flash and vanish now sits
there glowing. **+25% cells scanned for +8% of a tick** - 0.68 ms against a
16.7 ms frame. So the answer to "how much does an all-awake smoldering mass
cost" is: about a quarter more scanning, and it is affordable at this scale.
A whole-screen wood world set alight is the case the bench does not cover;
ticket 04 owns that eyeball.

The other two rows are noise, not signal, and `scannedLastTick` is what says
so - both scan *exactly* the same cells as before. Plant growth in particular
contains no wood, no fire and no ember; run alone in its own process it
measures 0.69-0.92 ms/tick both with and without the change, which is where the
in-suite 7% comes from.

A settled world still sleeps completely: an ember is not a settled cell, it is
a cell with business every tick, and it says so by writing `ra`.
