# 08 - Charted elements: species are the sim's unit, not the player's

**Status:** done (built on silt-tree-08-charted-grouping, 2026-09-04)
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04) - items "Buried doesn't make
sense as an element" and "sprout + stalk + tip + flower + petal as individual
elements feels wrong".
**Spec:** [../spec.md](../spec.md) §1, §6; ADR 0043 (growers/products split the
byte - why the species exist at all).

Two feedback items, one root cause: the chart renders **species** (the sim's
unit of bookkeeping) as if they were **elements** (the player's unit of
meaning). `buried` exists because a soak counter needs a byte (ADR 0043); to a
player it is not a thing you can have, it is what a seed does in mud. Likewise
sprout/tip/stalk/petal are stages and parts of one plant, split into species by
the same byte-ownership rule. The picker lists 25 nodes where the player's
mental model holds ~19.

## Proposed design (the scalable mechanism, not a hand-edit)

Add a presentation-level mapping to the graph derivation
(`apps/silt/src/docs/interactionGraph.ts`), NOT to the sim: each element may
declare a charted identity, e.g. `chartAs`:

- `buried -> seed`
- `sprout, tip, stalk, petal -> flower` (name decided: "flower")

Everything downstream derives:

- **Nodes**: the picker shows charted elements only. Tiles/appearance come from
  the charted element's own def.
- **Edges**: reagents/products rewrite through the mapping, then dedupe. A
  charted entry is backed by a *set* of raw edge keys (`lava+flower` absorbs
  `lava + {sprout,tip,stalk,petal,flower}`).
- **Witness keys do not change.** The store keeps raw, name-based keys exactly
  as today (forward-compatible, nothing migrates); only the view derivation
  groups them. The sim and `witness.ts` are untouched.
- **Edges that become self-loops** after mapping (`raise:sprout`,
  `bloom:tip` -> flower->flower; `germinate:sprout` stays seed->flower) stay
  charted as distinct stage entries under flower (decision 2 below).
- Mastery, tiers, denominators, the unlock predicate and the moments all run
  over charted entries via the existing single `involves()` seam in
  `entries.ts` - that seam is why this is one change, not five.

## Decisions (Ed, 2026-09-04 triage)

1. **Witnessed-when semantics**: a grouped entry is witnessed when *any*
   underlying raw edge fires. Mastery (the star) still requires every raw edge
   in the backing set - depth preserved, hunting removed.
2. **The plant's internal chain**: germinate/raise/bloom stay as separate
   charted stage entries under flower - the life cycle remains discoverable as
   a story. Self-loop edges after mapping chart as stages, they do not drop.
3. The charted name for the plant group is **"flower"** (Ed's original
   feedback wording).

## Consequences

- Denominators shrink (fewer, saner entries) - all derived, no migration.
- Fire's and lava's rings lose their stage-species duplicate spokes, which is
  most of ticket 09's crowding.
- Spec §1 vocabulary and the illustrative counts amend in the same change.

## Tests

- Mapping: buried never appears as a node; an entry backed by n raw keys
  reports witnessed per the chosen semantics; no raw key is orphaned
  (every edge in the ungrouped graph reaches exactly one charted entry).
- Regression fixture pinning the charted node list and entry count.
- Store round-trip: a blob written before this change derives the same charted
  progress after it.
- iwft (thin): witness `lava + stalk` in the sim; the flower row's count moves.

## As built

20 charted elements and 47 entries (the graph's 58 raw edges folded). The
mapping is `chartAs` on the derived graph (`interactionGraph.ts`, ids not names)
and `entries.ts` folds it in as it builds entries: a charted `Entry` now carries
its `sources` - the raw edges behind it, each with what *that* edge left, so
witnessing `fire + stalk` does not reveal the steam `fire + sprout` makes.
`EntryIndex` gained `witnessKeys`/`witnessKeysFor` (raw - what the recorder
reports and the store holds) beside `keys`/`entriesFor` (charted), and
`isWitnessed`, which every seen-count now reads.

Two deviations worth naming:

- The **new iwft is seeded, not grown**. Landing lava on a live stalk means
  waiting out a germination first (the ticket-07 case already spends 40s on
  one), so the new case seeds `bloom:tip` + `react:lava+stalk` - raw keys naming
  species the chart does not - and asserts the flower's row reads 2/9 with no
  stalk anywhere in the panel. The sim-to-chart half of the path is not
  untested: the ticket-07 case still grows a plant live, and now waits on the
  **flower** row appearing, which is a grouped key (`germinate:sprout`) making
  it from the sim through the store to the picker.
- **A stage spoke carries no arrowhead.** The raise and the bloom are entries
  whose every name is the focus itself, and an arrow from an element to itself
  says nothing; the flower's decay still points out, at the seed. Ring polish
  beyond that is tickets 09-11.

Tiers moved as a consequence: burial no longer being a step of its own puts moss
and flower one off the rail, and vine beside ash at 2. Spec §1, §3, §6 and the
new decision 11 record it, and the decision itself is [ADR
0049](../../../docs/adr/0049-silt-species-are-charted-as-elements.md).

**One thing for Ed, not resolved here.** Decision 1's two halves pull apart on
the five elements that own a grouped entry (flower, fire, lava, acid, seed):
their picker row counts *charted* entries, so it can read `9/9` with
`still to find: 0` while the star waits on raw edges the panel may not name
(spec §7). Hunting is removed from the counts and not from the star. Mud is
unaffected - its six entries are one raw edge each - so the unlock and the
completion moment stay honest. Recorded in spec decision 11 as an open
picker-legibility question, a candidate for its own ticket beside 09-11; the
code here implements the ruling as written.
