# 30 — "My boops" dialog: dynamic size with a sensible max

**Reported:** V1 feedback (Ed, 2026-08-07) — the dialog is a fixed size and too
small.

**Why it happens:** `GroovesPanel.module.scss` `.card` is `width: 352px` flat —
the phone card width from the design handoff — with `max-width: calc(100vw - 32px)`
and `max-height: calc(100vh - 64px)`. Nothing widens it on a laptop, so the list
sits in a narrow strip with a long inner scroll.

**Decision (grilled 2026-08-07):** `clamp(352px, 44vw, 560px)`. 560px fits a
thumbnail, a comfortable name and three icon buttons (rename, delete, export —
ticket 34) on one row without the row becoming a spread of gaps. A two-column
list at large sizes was considered and rejected as a separate feature.

**What to build:**
- Width `clamp(352px, 44vw, 560px)`, still capped by `calc(100vw - 32px)`.
  Phone rendering must be visually unchanged (352px is the clamp floor).
- Height: keep `max-height: calc(100vh - 64px)`, but let the card be as short as
  its content. **Only the list scrolls** — move `overflow-y: auto` off `.card`
  and onto `.list`, with the card a `min-height: 0` flex column, so the title,
  the save form (ticket 32) and the footer note never scroll away.
- The extra width goes to the name, not the thumbnail.

**Ships with:** 32 and 34 in one PR — all three rewrite this component's layout
and would conflict constantly as separate PRs (grilled).

**Design:** handoff §4 fixes the card's padding, radius, shadow, row geometry and
copy — those stay exact. Only the outer width/height and which element scrolls
change. Handoff amendment: the card's width is no longer a single number.

**Blocked by:** 35 — rename (so the copy lands once)

**Status:** resolved

- [x] Card grows with content between 352px and 560px; never wider than the
      viewport minus the 16px gutters
- [x] The list is the scrolling element; header, save form and footer stay put
- [x] Phone (<1024px) rendering visually unchanged
- [x] Whole-frontend test: with ~15 saved boops the card is at max height, the
      header is still visible, and the list is what scrolls

## Comments

Resolved 2026-08-08 (agent, Opus). Shipped with 32 and 34 on
`boop/30-32-34-boops-dialog`. `.card` is now `clamp(352px, 44vw, 560px)` under
the same `calc(100vw - 32px)` cap, and a `min-height: 0` flex column: header,
save form and footer are `flex: none`, `.list` owns `overflow-y: auto`. Phone
width is unchanged — 352px is both the clamp floor and what the old flat width
was. Two iwft cases cover it: 15 saved boops (card at `100vh - 64px`, 560px
wide, title in view, the list is the only scroller) and an empty list (card
shorter than the cap). Handoff §4 carries the width/scroll amendment.
