# 08 - Charted elements: species are the sim's unit, not the player's

**Status:** needs-triage
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
- `sprout, tip, stalk, petal -> flower` (naming open: "flower" vs "plant")

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
  `bloom:tip` -> flower->flower; `germinate:sprout` stays seed->flower) either
  drop from the chart or merge into one "seed grows into flower" entry - see
  open questions.
- Mastery, tiers, denominators, the unlock predicate and the moments all run
  over charted entries via the existing single `involves()` seam in
  `entries.ts` - that seam is why this is one change, not five.

## Open questions for Ed (why this is needs-triage)

1. **Witnessed-when semantics for a grouped entry**: witnessed when *any*
   underlying raw edge fires (recommended - the player should not hunt
   `lava + stalk` vs `lava + tip`), or all?
2. **The plant's internal chain**: do germinate/raise/bloom collapse to a
   single "seed -> flower" growth entry, or stay as 2-3 charted stage entries
   under flower ("the seed wakes", "the stem rises", "the tip blooms")? The
   latter keeps the life epic discoverable as a story; recommended.
3. The charted name for the plant group: "flower" or "plant"?

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
