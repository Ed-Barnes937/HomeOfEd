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
