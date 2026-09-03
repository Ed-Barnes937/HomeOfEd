# 05 - Field notes panel: tiles, picker, ring, header control

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01, 03
**Spec:** [../spec.md](../spec.md) §6, §7

The panel itself, to the accepted mockups. The interactive mockup and its
design notes are local-only at `.scratch/silt-discovery-tree/handoff/mockups/`
(`field-notes-standalone.html`, `README.md`) - open them before building;
spec §6 carries the committed summary (chrome tokens, tile recipe, sizes,
states).

## Design

- **Tile helper first**: one component/function builds every element tile
  from `hex` + archetype (square/cut-corner/diamond/hexagon + the two-stop
  pixel shade, 2px ink plate). Sizes 18/22/30/40/56. Every tile in the
  feature - picker, ring, products, moments - comes from this one helper.
- **Header entry control** next to SCENES: "Field notes" + `witnessed/37`.
  States: untouched (greyed numerals), in progress, ~250ms inverted tick-up,
  complete (inverted, nothing persistent). Opens the panel.
- **Panel**: desktop overlay (scenes-popover chrome, counters pinned in its
  header: elements n/19, interactions n/37, NEW n chip); mobile full-screen
  sheet (wrapped 30px tile picker rows, ring centred, footer pinned).
- **Picker**: all elements, tier then rail order (ticket 01's tiers), each
  row `seen/total` from `involves()`. Undiscovered rows: dark "?" tile,
  `- - -` name, not selectable. New-since-last-open: green plate edge,
  cleared on select. Mastered: drawn star after the name. Mud's row carries
  `n/5 to unlock`.
- **Ring**: selected element centred (56px), one spoke per witnessed entry;
  spoke label = outcome text + tappable product tiles (tap focuses that
  element). Edge kinds: reaction solid / decay long-dash / growth dotted,
  arrowhead at the product; arrowhead into the centre = "this makes me".
  Zero-product entries read "both consumed". Footer: `still to find: n` with
  empty notches - unwitnessed entries are never drawn (§7).
- **Spoiler invariant (§7)**: nothing in the panel may name a hidden
  element's name, hex or products - including the NEW list and spoke labels.
- **Empty state**: fresh install copy per the mockup ("nothing witnessed
  yet - pick an element on the left...").
- **Reset control** ("forget discoveries", `useArmedConfirm`) lives in the
  panel, wired to ticket 03's `reset()`.
- All state comes from ticket 03's seam; the panel renders derived data and
  dispatches selection - no storage or engine knowledge.

## Tests

- Vitest for the pure bits: picker ordering (tier then rail), spoke model
  building from a witnessed set (products resolved, zero-product case,
  arrow direction), still-to-find count.
- iwft (state-through-UI, the pragmatic split): seeded store -> open panel ->
  counts right; undiscovered row shows "?" and is inert; tap a product tile
  refocuses; the spoiler invariant (no hidden name appears anywhere in the
  panel DOM for a crafted state); mobile sheet renders via the existing
  mobile iwft pattern.
