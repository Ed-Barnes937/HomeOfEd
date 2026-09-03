# 01 - Entries derivation: keys, involves(), tiers, mastery

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §1, §2, §6

A pure, DOM-free module (suggested: `apps/silt/src/features/fieldNotes/entries.ts`)
that turns `deriveInteractionGraph()` into everything the feature needs to
count and derive. No UI, no storage - this is the shared brain that tickets
03-06 import.

## Design

- **Canonical edge keys**, name-based (spec §2): `react:<a>+<b>` with the two
  names sorted, `decay:<from>`, `grow:<grower>`. Smoke's fade
  (`becomes: empty`) produces no key - it is not an entry (§1).
- **`involves(edgeKey, elementName)`** - true when the element is a reagent
  *or* a product of the edge. This is the single definition of "an entry"
  (spec §6); every consumer (picker counts, ring, still-to-find, unlock chip)
  must read this predicate, never a re-derivation.
- **`entriesFor(elementName)`** - the edge keys involving an element, and the
  totals: water has 9 today, mud 5, fire 16 (good test fixtures - the mockup
  shows these numbers).
- **Tiers** by minimum transmutation depth from the paintables, computed to a
  fixed point over edges-with-products (mud/obsidian/smoke/steam/sulphur/ember
  1, moss/ash 2, vine 3 today - but assert structure, not a hardcoded table,
  except as one regression fixture).
- **Derivations from a witnessed-key set** (the only state this module ever
  sees is `ReadonlySet<string>`):
  - discovered elements = pre-knowns + any element a witnessed edge names as
    a product;
  - mastered = every key `involves()` says touches the element is witnessed;
  - unlocked = mastered ∩ unlockables. Declare `UNLOCKABLE_NAMES = ['mud']`
    here, beside the derivation that consumes it.
  - Unknown keys in the input set are ignored, never an error (spec §5
    forward-compat).
- Import `deriveInteractionGraph` from `src/docs/interactionGraph.ts` - do not
  re-derive from the registry (spec §2). Note this module computes against
  whatever `PAINTABLE_IDS` says *at runtime*, so it is correct both before and
  after ticket 04 lands the mud trim; don't hardcode "10 paintables" in the
  code (tests may pin today's numbers).

## Tests (vitest, pure)

- Key canonicalisation: `react:` names sorted; fade decay produces no key.
- `involves()` fixtures: water 9, mud 5, fire 16, stone 1 (lava+mud only);
  a product-only element (obsidian) has a non-empty entry list - the
  splitting-the-predicate bug from the design notes.
- Total entries = 37 with today's roster (32 + 3 productive decays + 2 growth).
- Discovery: empty set -> exactly the pre-knowns; witnessing `react:dirt+water`
  discovers mud; witnessing a zero-product edge (`react:acid+dirt`) discovers
  nothing.
- Mastery/unlock: the full 5-key mud set unlocks mud; any 4 of 5 does not;
  unknown keys in the set are inert.
- Tier fixture for today's roster.
