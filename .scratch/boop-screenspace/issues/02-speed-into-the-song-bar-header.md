# Speed moves from the transport into the song bar's header

Type: task
Status: ready-for-agent

**Blocked by:** —

## What to change

Move the tempo control out of `Transport` and into `PhoneSongBar`'s header row,
beside song play — the position `SongBar` already uses at >=1024.

- `apps/boop/src/features/songbar/PhoneSongBar.tsx` gains the Speed control:
  label, BPM readout, Slow/Fast endpoints, slider. `SongBar.tsx` is the
  reference for markup and wiring; match its `data-testid`s
  (`tempo-readout`, `tempo-slider`) so the existing page-object helpers keep
  working at both widths.
- `apps/boop/src/features/transport/Transport.tsx` loses `bpm` /
  `onTempoChange` and the whole tempo block. `HomePage` stops passing them.
- Page objects in `src/testing/` follow the control to its new home.

## Why

Two reasons, and the second is the one that forces it.

**Consistency.** The laptop already puts Speed in the song bar's header. The
phone putting it in a separate pinned transport is a difference with no reason
behind it, and it means the same control has two homes to keep in sync.

**Ticket 03 removes the phone transport entirely.** Speed lives there now and
`PhoneSongBar` has no Speed of its own, so without this the phone loses its
tempo control altogether. Doing it as its own ticket means the move is
reviewable and testable on the *current* layout, before the frame changes
underneath it — the shipped arrangement stays coherent throughout.

Alternatives rejected: inside the clip editor card (wrong — tempo is
song-wide, not clip-scoped, and it would read as a property of the clip);
the "..." menu (buries a control that is half the fun of the toy).

## Verify

- Existing tempo `.iwft` coverage passes with the control in its new place.
- At phone widths, changing Speed still retunes playback and still marks the
  boop edited (ADR 0031 — a speed change is a mutation).
- The transport still holds clip play and the "+" action, and still clears the
  home indicator.
- `pnpm --filter boop run lint | typecheck | test` all green.
