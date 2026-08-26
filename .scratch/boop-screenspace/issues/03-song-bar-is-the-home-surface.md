# The song bar becomes the home surface; the grid opens as a card

Type: task
Status: ready-for-agent

**Blocked by:** 02

## What to build

The chosen direction (`clip-dialog` in the prototype — see
[`../spec.md`](../spec.md)). At **every** width:

- The **song bar is the home surface**, in the scrolling region. It is what a
  child lands on.
- The **grid opens as a card** — the paper-card shape `BoopsPanel` and
  `NewClipPicker` already use. Bottom-anchored below 1024, centred at and above
  it.
- The **dock holds one launcher row** for the clip: clip play, the clip's tint
  dot and name, and a labelled way in. Nothing else. Two routes into the
  editor: this row, and a tap on any clip chip in the song bar.
- **No second pinned bar.** The phone dock previously stacked the launcher over
  `Transport` and both led with clip play — two identical play buttons, one
  above the other. Ticket 02 moved Speed out of the transport, so the transport
  goes entirely.

`apps/boop/src/prototype/PrototypeFrame.tsx` is the working reference for the
arrangement and the card geometry. **It is not the implementation** — it was
written under prototype rules (no tests, minimal error handling, shipped
components rehoused rather than rewritten). Rebuild it properly.

## Why this direction

The song is already the less discoverable half of the app, so it is the half
that stays on the frame. Hiding it makes a real problem worse; a tabbed variant
that hid it hardest was rejected for exactly that. Pointing the dialog the
other way puts the arrangement in front of the child by default and makes the
grid the focused thing they choose to open.

## Geometry that must survive

- **The grid never shrinks** (ADR 0027). 6 x 16 at every width, no row and no
  step dropped. Below 1024 the pinned rail and the snap-scrolling step window
  are unchanged inside the card.
- **The card must fit the fixed-geometry column.** The card *contains* the
  column, so its own padding adds to `--column-width` — the prototype clipped
  steps 13-16 at 1440 until the card was `min(calc(var(--column-width) + 36px), 100%)`.
  Measured, not guessed.
- Clip play stays inside the grid well (`ClipControl`) at >=1024 as it does
  today; the launcher's play is the same action reached from outside the card.
- The card is not a second scroller for the page — it has its own bounded
  body, as `BoopsPanel` does.

## Watch for

- **Song play must not be duplicated.** With the song bar on the frame it is
  always visible, so the launcher carries *clip* play only.
- **The playhead readout** rides on `ClipHeader` at >=1024 and on the WHOLE
  SONG strip below it. `ClipHeader` moves into the card — decide where the
  laptop readout lives and say so in the ADR.
- **Saved-state visibility** (ADR 0031) is unaffected in substance, but the
  chrome that carries it must still be on screen at every width.

## Verify

- `.iwft` coverage for the new arrangement at phone, tablet and laptop:
  the song bar is on the frame, the grid opens from both routes, and both play
  buttons are reachable without scrolling.
- Existing suites that assert the *old* arrangement will fail by design —
  `playBarPinned.iwft.tsx`, `phoneLayout.iwft.tsx`, `stickyBottomBar.iwft.tsx`
  and friends. Rewrite them to the new promise; do not delete coverage to go
  green.
- `pnpm --filter boop run lint | typecheck | test` all green.

## As built

Decisions this ticket had to make that the ticket above left open. Ticket 04's
ADR should record them.

### The phone's "+" New boop action moved into the "⋯" menu

The transport was New boop's only phone home. It is now the **first entry in
the phone's "⋯" menu**, above My boops, with Clear grid still last as the one
danger item.

The menu is where every action the phone chrome drops already lives, and
`TopBar` leads its own action group with New boop, so the two widths agree on
the order. Rejected: a second button on the launcher row (the row is clip play,
the clip's name and the way in — a whole-boop reset does not belong on it), and
the bottom of the menu beside Clear grid (it is not styled as a danger action at
either width, and moving it there would make the phone disagree with the top
bar for no reason).

### The laptop playhead readout moved into `SongBar`'s header

`Position 4 · bar 2 of 4` rode on `ClipHeader`, and `ClipHeader` is inside the
card now. It sits in **`SongBar`'s header row, immediately after "N bars"** —
it reads the *song's* playhead, so it belongs with the song's other numbers,
and the header stays on the frame when the card closes rather than disappearing
with the header that used to carry it. It shrinks and ellipsises so Speed is
never the thing that gives way in the tablet band. The phone is unchanged: its
readout is on the WHOLE SONG caption row (boop-playhead ticket 06).

`ClipHeader`'s `readout` prop and `.readout` style are gone — nothing passed
them any more.

### The card is `--column-width + 36px` at ≥1024, on a 14px overlay gutter

`ClipEditorCard.module.scss`: `width: min(calc(var(--column-width) + 36px), 100%)`
with `padding: 10px 18px 18px`, inside an overlay whose gutter is **14px**, not
the 32 a dialog would normally take. The card *contains* the fixed-geometry
column, so its own horizontal padding has to be added to `--column-width`
(1196px) or the last steps are clipped — 2 × 18 = 36 is the prototype's figure
and it still measures right after ticket 02.

The gutter is the part the prototype got wrong and review caught. The overlay's
gutter and the card's padding come out of the same budget as the frame's
`frame-padding`, and at 32px they overspent it: measured, the grid well gained
**25px of sideways scroll at 1024** and **8px at 1280** — 1280 being the exact
width ADR 0033 exists to make fit. 14 + 18 = 32 at ≥1280 and 14 + 12 = 26 in the
tablet band, which are the frame's own two numbers, so the card gives the grid
exactly what the frame gave it. The tablet band takes its own width formula
(`--column-width + 24px`) to match its 12px padding.

`verifyCardHoldsTheColumn` in `HomePagePom.ts` measures the card's content box
against **`stage-column`'s live width** — the frame's own column, behind the
card. Comparing it with `--column-width` instead was a tautology (both numbers
came from the same stylesheet rule) and is exactly why the overspend got past
the first pass. It runs at 1024, 1280, 1440 and 2560, paired at each with
`verifyGridWellHasNoSidewaysScroll`.

### Clip play is the well's footer at *every* width

Not in the ticket, and it is a gap the prototype had too. The card is a modal
with a dimmed backdrop, so the dock's launcher is unreachable while the card is
open. At ≥1024 `ClipControl` inside the well answers that; below 1024 there was
nothing, so a child editing a clip on a phone had no way to hear it — a
regression against the pinned transport they had before.

`PhoneGrid` therefore renders the same `wellFooter` slot `Grid` does, and
`ClipControl` gained phone geometry and a `showClearGrid` flag (false on the
phone — Clear grid stays in the "⋯" menu). `PhoneGrid.module.scss`'s
`$grid-floor` arithmetic gained a `$clip-control: 74px` term, in both the well's
`min-height` and its short-window `max-height`, because the well has one more
`flex: none` child than it did.

### The two surfaces are never on screen together, and the tests say so

The clip editor is a modal, so the song bar, the chrome and the dock are behind
it, and the loop map (in the card) and the WHOLE SONG band (on the song bar) can
no longer be measured in the same breath. `HomePagePom` routes: helpers that act
*on the grid* open the card first, helpers that act on the song bar or the
chrome close it first, and assertions never route. `verifyBandsDoNotScroll`,
`verifyBandTapTargets` and `verifyBandsAllowVerticalScroll` became per-band
(`'loop' | 'song'`) for the same reason.

One behavioural consequence, named rather than fixed: on the phone Clear grid is
in the "⋯" menu and the grid is behind the card, so a child no longer watches
the grid clear. Before, the grid was on the frame while the menu was open. The
alternative is a second Clear button in the well, which the design forbids.
