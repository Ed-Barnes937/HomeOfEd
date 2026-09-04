# 12 - Tag chips on the focused element's entry

**Status:** ready-for-agent
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
