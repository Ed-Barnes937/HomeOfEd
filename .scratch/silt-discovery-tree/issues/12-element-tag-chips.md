# 12 - Tag chips on the focused element's entry

**Status:** done (built on worktree-agent-ab8a8a41d080b143c, 2026-09-04)
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04) - "add tags for the element
at the top of its field notes entry, `[flammable]` for e.g.".
**Spec:** [../spec.md](../spec.md) §6-§7.

Every element already declares `tags` in the roster (`elements.ts` -
`flammable`, `solid`/`powder`/`liquid`/`gas`, `energy`), and the tags are
load-bearing sim truth (the tag rows key on them), so surfacing them is free
information the player can act on - "flammable" on wood *is* the hint that fire
has business with it.

## Design

- Chips rendered under the focused element's name in the ring header (desktop
  and phone sheet), styled like the existing count chips: `[flammable]`,
  `[powder]`, ...
- The mapping from raw tag to player-facing label lives in `panelModel` (one
  small allowlist): `flammable` shows as-is; the four archetype-ish tags show
  as-is (the tile shape already implies them, but the word is screen-readable
  where the shape is not); `energy` either shows or is dropped - implementer's
  call, record it in the allowlist with a comment. Unknown future tags are
  dropped, not shown raw: a new sim tag should not leak jargon into the panel
  without a decision here.
- Spoiler-safe by construction: chips render only for the *selected* element,
  and only discovered elements are selectable. Nothing new goes through
  `refOf`, but keep the chips out of any path that renders hidden elements.
- Data path: `elementAppearance`/`panelModel` read the registry def they
  already hold - no sim change, no store change.

## Tests

- panelModel: wood's row model carries `[solid] [flammable]`; an unknown tag is
  dropped; a hidden element's model carries no tags field at all.
- iwft (thin): select wood in the panel, the flammable chip is visible.

## As built

- `elementTags(registry)` joins `elementAppearances` in
  `features/fieldNotes/elementAppearance.ts` - the **raw** name-keyed sim tags,
  off the same registry the tiles are drawn from. No sim change, no store
  change, and the panel is still the only thing that reads a registry.
- The allowlist (`TAG_LABELS`) and `chipsOf` live in `panelModel.ts`. It is
  ordered, and the chip order is the allowlist's, not the roster's - so wood
  reads `[solid] [flammable]` whichever way its `tags` array is written.
- **`energy` shows.** The paint rail already groups fire under a player-facing
  "Energy" heading (`features/palette/paletteGroups.ts`), so dropping the word
  here would leave two surfaces disagreeing about one element; and it says
  something the gas hexagon does not. It keys no reaction row today, which
  makes it the weakest chip on the list rather than a wrong one. Recorded in
  the allowlist comment, as the ticket asked. `wall` is deliberately absent:
  it belongs to the out-of-bounds sentinel, not to any element.
- Styling is `.newChip`'s 2px ink border with `.counterLabel`'s type. The chips
  sit at a fixed 55px under the centre name; because that offset does not scale
  with the ring, `mobile.iwft.tsx` holds them clear of the spoke tiles at a real
  phone viewport rather than trusting the arithmetic.

## Deviations from the ticket

Both were raised by the review pass and are deliberate.

1. **"Nothing new goes through `refOf`"** - reversed. The chips *are* filled in
   by `refOf`, because that is the existing masking seam: putting them there
   means the one `discovered` check that withholds a hidden element's name
   withholds its tags on the same line, instead of a second guard that a future
   caller could forget. The cost is that `refOf`'s three `moments.ts` call sites
   now have a tags channel; none passes a source, so no moment card can grow
   chips by accident, but it is a channel that did not exist before.
2. **"wood's row model carries `[solid] [flammable]`"** - the *ring centre*
   carries them, not the picker row. Threading a tag source into `pickerRows`
   put an allowlist pass over all 25 rows on every view change to populate a
   field nothing renders (the Design section puts the chips in the ring header
   only), so `ringFor` is the sole supplier. `PickerRow` still inherits the
   optional `tags`, and a test pins that it stays absent.
