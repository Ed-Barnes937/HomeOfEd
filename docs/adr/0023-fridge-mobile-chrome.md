# 0023 — fridge: responsive mobile chrome (icon bar + FAB add-overlay)

- **Status:** Accepted (breakpoint revised 2026-07-11 — see *Revision* below)
- **Date:** 2026-07-11
- **Related:** [0022-fridge-cross-device-board-consistency.md](0022-fridge-cross-device-board-consistency.md)
  (the fixed logical canvas + scale-to-fit this builds on — the board scales
  into whatever stage the chrome leaves it); [0010-shared-fridge-boards.md](0010-shared-fridge-boards.md)

## Context

ADR 0022 fixed the board to a constant 1080×720 logical canvas rendered
scale-to-fit, and explicitly deferred **mobile chrome adaptation** as a separate,
additive concern: *"The reason the surface is tiny on phones is the fixed
98px/214px chrome, not the coordinate model. Adapting the toolbar/tray … only
changes the stage area the fixed-aspect board scales into — it must not touch
the board coordinate space."*

On a phone the desktop chrome is unusable: the toolbar's name field + four text
buttons + helper text wrap, and the inline tray eats a fixed 214px off the
bottom. With 312px of fixed chrome the board scales down to a short band. The
board model must not change (the cross-device guarantee), so this is purely a
layout/chrome problem.

## Decision

Adopt the owner-chosen **"icon bar + add overlay"** design, gated by the
**mobile rule** in the *Revision* below (touch device **or** narrow viewport).
When the rule does not match the layout is **pixel-identical to today** — the
desktop chrome is unchanged and the mobile chrome is not mounted.

1. **Top bar → slim 52px icon strip.** Back icon, a compact "the fridge"
   wordmark, a Save icon button, and an overflow "⋯" menu holding name editing,
   New, Empty the fridge, the Share affordance, and the saved-boards list — every
   desktop action stays reachable. The verbose helper text is dropped. All
   icon-strip tap targets are ≥44px.
2. **Board unobstructed.** On mobile the stage's fixed offsets shrink from
   `top:98px`/`bottom:214px` to `top:52px` (the strip) / `bottom:0` (no inline
   tray). The 0022 scale-to-fit math then grows the board to fill the freed
   space.
3. **FAB "+" → full-screen add overlay.** A ≥44px bottom-right FAB opens a
   full-screen overlay carrying the **existing** tray content — `Tabs`,
   `ColorPicker`, `PaletteGrid`, and `AppearanceColumn` (finish + kitchen light),
   reused, not duplicated. Tapping a tile adds a magnet to the board; the overlay
   stays open for multiple adds and closes on an explicit **Done**.
4. **Landscape nudge kept, repositioned.** With the board now unobstructed it is
   *less* critical than under 0022, but a portrait phone is still width-bound
   (the 3:2 canvas fills far more of the screen in landscape), so the dismissible
   hint stays useful. It moves from above the (now-absent) tray to low-centre,
   clear of the FAB.

**Mechanism.** Which chrome renders is chosen by a `useIsMobile()` matchMedia
hook (the mobile rule below), read synchronously on first render so there is no
layout flash. Conditional *rendering* (rather than CSS `display` toggling of
duplicated markup) keeps desktop's DOM — and its test-ids / accessibility tree —
completely untouched, and avoids duplicate-testid collisions. The stage offset
change is a plain CSS `@media` query at the same breakpoint.

## Options considered

- **(a) Icon bar + FAB add-overlay (chosen).** Minimal top chrome, board fills
  the screen, add flow is an explicit modal. Matches the owner's pick. Reuses
  the tray components wholesale.
- **(b) Collapsible bottom-sheet tray.** Keep the tray but as a drag-up sheet.
  More gesture surface to build and conflicts with the board's own pan/zoom
  gestures from 0022; heavier for no clear win over (a).
- **(c) Responsive fl[ex]-wrap of the existing bars.** Just let the desktop
  toolbar/tray reflow. Still eats vertical space, still cramped, and the text
  buttons don't shrink to usable touch targets. Rejected.

## Consequences

- **Desktop is untouched** — same components, same CSS, same DOM on a
  fine-pointer viewport ≥1024px. The existing `.iwft` suite runs at the default
  desktop viewport (1280×720, fine pointer) and stays green, which is the
  regression guard.
- **No board/model/share change.** Coordinates, `StoredBoard`, and `clampOne`'s
  constant bounds are all exactly as 0022 left them. This ADR is chrome only.
- **Tray components are now shared by two hosts** (desktop `Tray`, mobile
  `AddPanel`). They stay presentational and prop-driven, so this is reuse, not
  duplication.
- **Full-screen overlay hides the board while adding.** Deliberate (owner chose
  "keep open for multiple adds, explicit close"); magnets land behind it and are
  seen on Done. A future refinement could make it a partial sheet.
- **Very short landscape viewports** (the 0022 open question) are improved but
  not solved — with the chrome now ~52px the board gets most of the height, but
  a landscape phone is still short. No further chrome to shed; acceptable.

## Open questions

- Whether the add overlay should become a partial bottom sheet so the board
  stays visible while adding. Deferred — current full-screen is per owner.

## Revision (2026-07-11) — breakpoint rule

The original `max-width: 640px` gate was too narrow. On a portrait tablet or
large phone (viewport 641–1023px) the app fell through to the **desktop** chrome,
which overflows at those widths: the TopBar's wordmark/helper text collide with
the floating saved-fridges row, and the inline tray overruns. A pure width
breakpoint also can't tell a touch tablet from a small desktop window.

**Revised rule** — the compact chrome is used when **either**:

```
(pointer: coarse), (max-width: 1023px)
```

i.e. **any touch device** (`pointer: coarse` — phones and tablets, at any width)
**or** any viewport **narrow enough that the desktop chrome would overflow**
(`max-width: 1023px`, covering resized desktop windows and non-touch narrow
displays). The desktop chrome therefore renders **only on a fine-pointer
viewport ≥1024px** — which is where it was already designed to fit, so it stays
pixel-identical there. `max-width: 1023px` was chosen as the boundary because the
desktop TopBar's full control row needs ~1024px before it wraps/overlaps.

The rule lives in one place — `useIsMobile.MOBILE_QUERY` — and is mirrored by the
stage-offset `@media (pointer: coarse), (max-width: 1023px)` query in
`FridgePage.module.scss`. The default `.iwft` suite (1280×720, fine pointer, no
touch) matches neither clause and keeps the desktop regression guard; new cases
cover a portrait-tablet width (810px → compact chrome) and the overflow-menu
layout. This supersedes the earlier "tablets currently get the desktop chrome"
open question.

Also fixed alongside: the saved-fridges row (`SavedChips`) is absolutely
positioned for its desktop home (region B, floating under the TopBar). Reused
inside the mobile overflow menu that positioning leaked, pinning the row to the
menu's top-left so it overlapped the Share/name items. `SavedChips` now takes an
`inline` prop (set by `MobileBar`) that lays the row out in normal flow.
