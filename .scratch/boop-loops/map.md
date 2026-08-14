# Map: boop loops (clip lanes)

Label: wayfinder:map
Driver: ed-barnes937

## Destination

An agreed spec at `.scratch/boop-loops/spec.md` for the clip-lanes feature —
the design handoff's open questions resolved, ready to hand to
`/to-tickets` + `/implement` as a separate execution phase. This map decides;
it does not build.

## Notes

- Design source of truth: `docs/reference/design_handoff_clip_lanes/README.md`
  (the **2a Clip lanes** frame). Recreate pixel-close at ≥1280px — the numbers
  are final. No new controls beyond the handoff, with **one deliberate
  exception**: "+ New clip" opens a picker (Blank + sample clips) — decided in
  [Starters and New boop vs clips](issues/07-starters-and-new-boop.md).
- All breakpoints are in scope: close the gap between the laptop design and
  tablet (≤1279px) / phone (≤1023px) sensibly, respecting ADR 0027 (grid never
  shrinks) and ADR 0030 (one scroller).
- Accessibility is folded into the spec as "match the grid's existing
  arrow-key model" — no ticket.
- Grilling tickets use `/grilling` + `/domain-modeling`; prototype tickets use
  `/prototype`. TDD per repo rules when execution starts (not in this map).
- Vocabulary (in `apps/boop/CONTEXT.md`): **Clip**, **Song**, **Placement**,
  **Lane** — adopted during charting.

## Decisions so far

- [Song model limits](issues/01-song-model-limits.md) — song fixed at 16
  positions; max 5 clips (unique tints), "+ New clip" disables at the cap;
  no lane overflow handling — the grid region stays the only scroller.
- [Clip length](issues/10-clip-length.md) — fixed at 16 steps / 4 bars; longer
  phrases come from placements, never variable-length clips.
- [WAV export scope](issues/06-wav-export-scope.md) — export renders the whole
  song; clips are not individually exportable.
- [The "edited" definition grows](issues/08-edited-definition.md) — placements,
  clip add/delete/rename, and speed changes all count as edited (ADR 0031).
- [Save format v2](issues/02-save-format-v2.md) — additive at version 1
  (ADR 0032): `patterns` becomes the clip list (optional `name`), a 16-char
  placement string (1-based clip digits — caps a future ceiling at 9), optional
  `gridClip`; old boops decode to one clip + no placements; strict decode; no
  share-version bump. Settles ticket 09's data-model half.
- [Song-mode playback mechanics](issues/03-song-playback-mechanics.md) — proven
  gapless on the real engine (deterministically and by ear): a ~30-line
  conductor swaps `setPattern` at step 15's `onBeat`; **no `SequencerEngine`
  contract change**. Spec note: the sounding clip must come from the draw
  channel, not `getPattern()`, or the grid flashes the next clip one lookahead
  early. Prototype on branch `prototype/03-song-mode`.

- [Small-screen lane treatment](issues/04-small-screen-lanes.md) — phone: song
  bar in the scrolling region, lanes on the step window's exact geometry
  (pinned 92px chip column, 32px squares, snap + `pan-x`, PhoneGrid's
  paint-vs-scroll rules), clip play and Speed stay in the pinned transport;
  tablet: the laptop song bar with lanes shrunk to fit the column, no sideways
  scroll. Prototype on branch `prototype/04-small-screen-lanes`.

- [Starters and New boop vs clips](issues/07-starters-and-new-boop.md) —
  starters retired, replaced by **sample clips**: pattern-only, plainly
  labelled ("Slow bass"), offered from a "+ New clip" picker (Blank first)
  and layered loop-pedal style; "New boop" becomes a plain no-dialog reset
  to one blank clip; Clear grid goes clip-scoped (an edit, no longer drops
  the loaded boop); first visit seeds a one-clip song from a sample clip;
  roster authored in the
  ["+ New clip" picker prototype](issues/12-new-clip-picker-prototype.md).

- [Lane reordering model](issues/09-lane-reordering.md) — tints travel with
  the clip (optional `tint` field, ADR 0032 amendment; lowest unused on
  create); reorder is a whole-chip vertical drag with a tap-vs-drag movement
  threshold, lanes make way live; Ctrl/Cmd+Arrow moves the focused chip;
  reordering counts as "edited".

- [Share links for songs](issues/05-share-links-for-songs.md) — keep plain
  base64url JSON: worst-case song URL is ~2.5K chars, within every real limit;
  no compression, no short-link server. Spec records the numbers plus a
  revisit trigger (clip cap past 5, or a QR affordance).

- ["+ New clip" picker prototype](issues/12-new-clip-picker-prototype.md) —
  the picker is a **dialog** (the New boop paper shell, Blank first); all
  eight authored sample clips ship as the launch roster (mostly single-role,
  two with a light second row); no per-card preview — picking is how you
  hear one. Prototype on branch `prototype/12-new-clip-picker`.

- [Assemble the spec](issues/11-assemble-spec.md) — the destination reached:
  [`spec.md`](spec.md) written, folding the handoff and every decision above;
  ADR 0031 amended ("edited" = any mutation of the song); empty-song WAV
  export falls back to the grid clip. **No open tickets remain — the map is
  complete.** Next step: `/to-tickets` + `/implement` against the spec.

## Not yet specified

_(empty — everything in scope is now a ticket or decided)_

## Out of scope

- **Dragging a placement sideways** — undesigned in the handoff; remove and
  repaint covers it. Returns only as a fresh effort.
