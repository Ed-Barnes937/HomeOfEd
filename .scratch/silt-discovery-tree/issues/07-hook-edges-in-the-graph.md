# 07 - Hook edges: the life plant's transmutations join the graph

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01, 02 (both landed; written after merging the life-followup epic)
**Spec:** [../spec.md](../spec.md) §2, §3; life epic context in
`.scratch/silt-life-followup/` and ADR 0043 (growers/products split the byte)

The life-followup epic (merged to main 2026-09-04) creates five elements -
moss, sprout, tip, stalk, flower - from `onTick` hooks that the derived
interaction graph deliberately does not report: germination and the stalk's
growth write two cells or depend on history, so no existing edge shape
(`ReactionEdge`, `DecayEdge`, `GrowthEdge`) can carry them. That was fine for
a maintainer's doc; it breaks the discovery tree's §3 premise that "every
discoverable element is the product of at least one edge". Today those five
can never be discovered: all 54 charted entries can be witnessed while the
element count sits at 20/25 forever, with five permanent "?" tiles.

Interim state (landed with the merge, this ticket removes it): the five are
undiscoverable silhouettes; elements with no producing edge sort after every
tiered element in the picker.

## Design

- **New edges in the derivation** (`apps/silt/src/docs/interactionGraph.ts`),
  one per hook transmutation the player can witness. The proposed entry set -
  the minimum that makes all five elements products of something:
  - `germinate:moss` - buried seed + standing water (the 2-cell soak) ->
    moss. Reagents: buried, water. Products: moss.
  - `germinate:sprout` - buried seed, sky open, no standing water -> sprout.
    Reagents: buried. Products: sprout.
  - `raise:sprout` - a sprout raises its tip and becomes the stem base.
    Reagents: sprout. Products: tip, stalk.
  - `bloom:tip` - the tip's budget runs out (or it is boxed in) -> flower.
    Reagents: tip. Products: flower.
  - NOT entries: the tip's climb (it leaves stalk behind, but stalk is
    already `raise:sprout`'s product and a climb is movement, not a new
    transmutation to the player's eye), petal shedding (petal is already
    `decay:flower`'s brood product; shedding is the same flower doing the
    same thing early), evaporation (a disappearance, like smoke's fade), and
    the seed bank's dirt refund (dirt is pre-known).
  Whether these ride in a widened `GrowthEdge` or a new `HookEdge` shape is
  the implementer's call; the doc generator renders them in the table either
  way, so `pnpm --filter silt run graph` + the drift test gate the change.
- **Edge keys** (`features/fieldNotes/edgeKeys.ts`): extend the codec with the
  new kinds. Keep the key text stable and name-based like the rest
  (`germinate:moss`, `raise:sprout`, `bloom:tip`).
- **Witness sites** in the sim core, same discipline as ticket 02 (perf is
  sacred; no RNG, no allocation, one flag write on first witness):
  - `seedBank.ts` germination: which of the two entries fired is decided at
    the germination site (it already knows the soak outcome).
  - `stalk.ts`: the sprout's raise and the tip's bloom.
  - `Api.witnessGrowth()` is the precedent for a hook reporting its own
    transmutation; either widen it (an argument naming the entry) or add
    sibling methods - update ADR 0048 with whichever, and keep the
    "recorder is off to the side of the simulation" rule true.
- **Derivations need no change by design**: entries.ts consumes whatever the
  graph reports, so discovery, mastery, tiers, denominators and the picker
  all pick the new edges up. Remove the interim tier fallback for
  producer-less elements (there are none afterwards) and its tests.
- **Determinism stays green with the new sites in place** - the
  non-negotiable, exactly as ticket 02.
- **Spec §3 amendment** in the same change: restore the "every discoverable
  element is the product of at least one edge" premise by stating the hook
  edges are part of the graph, and update the illustrative counts
  (25 elements, 58 entries with this ticket's four).

## Tests

- Graph: the four new edges present with the right reagents/products; drift
  test green after regen.
- Sim (vitest, deterministic seeds, the life epic's own tests as the
  pattern): a buried seed under standing water eventually witnesses
  `germinate:moss` and nothing else; a dry germination witnesses
  `germinate:sprout`; a sprout witnesses `raise:sprout`; a boxed-in tip
  witnesses `bloom:tip`. Fades and the dirt refund record nothing.
- entries: moss/sprout/tip/stalk/flower each have a producing edge; total
  entries 58; the five have defined tiers (assert structure, pin one
  regression fixture).
- Determinism test green; bench eyeballed.
- iwft (thin): grow a plant from a buried seed over water; the moss/sprout
  tile reveals and the panel's element count moves.
