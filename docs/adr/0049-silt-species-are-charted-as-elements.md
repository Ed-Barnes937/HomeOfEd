# 0049 - silt: field notes charts species as the elements a player holds

- **Status:** Accepted (2026-09-04, landed with
  `.scratch/silt-discovery-tree/issues/08-charted-element-grouping.md`)
- **Date:** 2026-09-04
- **Related:** `.scratch/silt-discovery-tree/spec.md` §1, §6 and decision 11;
  [ADR 0043](0043-silt-growers-and-products-split-the-byte.md) for why the
  species exist at all;
  [ADR 0048](0048-silt-discovery-witness-in-the-sim-core.md) for the witness
  the stored keys come from. Implemented as `chartAs` in
  `apps/silt/src/docs/interactionGraph.ts` and the fold in
  `apps/silt/src/features/fieldNotes/entries.ts`.

## Context

The chart rendered **species** - the sim's unit of bookkeeping - as if they were
**elements**, the player's unit of meaning. `buried` exists because a soak
counter needs a byte to live in (ADR 0043); to a player it is not a thing you
can have, it is what a seed does in mud. Sprout, tip, stalk and petal are stages
and parts of one plant, split by that same byte-ownership rule. The picker
listed 25 nodes where the player's model holds about 19, and fire's and lava's
rings each grew four near-identical spokes for the parts of one flower.

The obvious fixes were both wrong. Merging the species in the sim would undo
ADR 0043 and cost the behaviour the split buys. Hand-editing the picker's node
list would leave the counts, the tiers, the mastery predicate and the unlock
disagreeing with it within one roster change.

## Decision

1. **The mapping is presentation, and it lives in the graph derivation.**
   `chartAs` is declared in `interactionGraph.ts` by species id, beside the
   roster knowledge it depends on, and never in `src/sim`. The generated doc
   still reports the raw chemistry - it is the maintainer's view of what the sim
   resolves - and gains only a table naming the mapping.
2. **The fold happens once, at the `involves()` seam.** `entries.ts` rewrites
   every name through `chartAs`, recomputes each key from the charted names, and
   collects the edges that land on the same key into one entry. Nodes, edges,
   tiers, denominators, mastery, the unlock predicate and the moments are all
   derived from that, so none of them can disagree.
3. **Witnessed by any, mastered by all.** A charted entry is witnessed the first
   time any of the raw edges behind it fires, and mastered only when every one
   has. Grouping removes the hunt for a fifth identical spoke; it does not
   remove the depth.
4. **A charted entry keeps its raw edges as `sources`, each with what *that*
   edge left.** Discovery reads the source, not the entry: witnessing
   `fire + stalk`, which leaves fire, must not reveal the steam that
   `fire + sprout` leaves. The entry's own `products` is the union, and it is
   what the ring's words say the pair can do.
5. **Stage edges stay entries.** Germinate, raise and bloom become self-loops
   under flower once charted, and they are kept rather than dropped: the life
   cycle stays a story the player finds one step at a time. They carry no
   arrowhead, since both ends would be the ring's centre.
6. **Stored keys stay raw.** What the sim reports and what `fieldNotesStore`
   holds are unchanged and name-based, so a blob written before this change
   derives the same progress after it. Changing the mapping needs no migration.

## Consequences

- 20 elements and 47 entries where there were 25 and 58, all derived - and most
  of ticket 09's ring crowding is gone with lava's and fire's duplicate spokes.
- `EntryIndex` now speaks two vocabularies: `keys`/`entriesFor` are charted,
  `witnessKeys`/`witnessKeysFor` are the raw ones the recorder reports and the
  store holds. Confusing them silently breaks mastery, so the app's scoped
  `CLAUDE.md` names the distinction.
- Tiers moved: burial is no longer a step of its own, so a seed in the ground
  germinates one step off the rail and moss and flower sit at tier 1, vine and
  ash at 2.
- The graph derivation now changes for two reasons - the chemistry it reports
  and the mapping it declares. That is the price of putting roster knowledge
  where the roster is; the alternative was a second module that had to be kept
  in step with `v1Elements` by hand.
- A mapping is one hop only, never a chain, so folding cannot depend on the
  order the pairs are declared in.
