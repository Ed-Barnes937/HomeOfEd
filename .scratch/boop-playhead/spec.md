# Spec: boop — controllable song playhead

Status: **proposed** — decisions §7 are open for the spec owner to promote or
veto. Everything else is ready for `/implement`.

The song's position is output-only today. This effort makes it **settable**: a
child can put the playhead where they want it, on the song and inside a clip,
and the playhead stops being a playback artefact and becomes a persistent fact
about the boop.

**Sources of truth:**

- **Visuals (both frames):**
  [`docs/reference/design_handoff_playhead/README.md`](../../docs/reference/design_handoff_playhead/README.md)
  — frame **1b** (laptop, ≥1280px) and frame **1d** (phone, ≤1023px). Every
  geometry number there is final; recreate pixel-close. This spec does not
  restate those numbers — it records the mechanics the handoff could not
  specify and the decisions §7 it left open.
- **Engine contract:** [ADR 0024](../../docs/adr/0024-boop-sequencer-engine-seam.md),
  amended by this effort (ticket 01).
- **Vocabulary:** [`apps/boop/CONTEXT.md`](../../apps/boop/CONTEXT.md) —
  **Clip**, **Song**, **Placement**, **Lane**, **Position**. This effort adds
  **Bar**, **Global bar**, and **Scrub** (§3).
- **Existing constraints:** ADR 0027 (the grid never shrinks), ADR 0030 (fixed
  frame, one scroller), ADR 0031 (what "edited" means).

---

## 1. Overview

Four changes, in the handoff's order:

1. A **song playhead strip** in the song bar, above the ruler — a scrub track
   the width of the lane grid.
2. The song's position becomes **settable**, at bar resolution (4 bars per
   position).
3. The playhead **survives a stop**, drawn at 45% opacity.
4. The same at clip level: a **16-step scrub rail** in the grid well, and on
   the phone the existing `WHOLE LOOP` map becomes that scrubber.

Nothing about the data model changes. A playhead position is not saved, not
shared, and not part of the save format — it is view state that lives as long
as the page does.

## 2. Scrubbing is listening, not editing

This is the load-bearing rule of the effort. Every song mutation today funnels
through `HomePage`'s `updateSong`, which calls `stopSongPlayback()` and then
`markEdited()`. A scrub must do **neither**:

- It must not `markEdited` — moving the playhead does not change the boop, so
  the saved-state chrome (ADR 0031) must not react to it.
- It must not stop playback. Every other interaction with the song stops it,
  for the correctness reason recorded in boop-loops ticket 16 (the engine runs
  one lookahead ahead of the sounding clip, so an edit mid-song could read the
  wrong clip back). A scrub never reads the engine's pattern back, so that
  reason does not apply.

So scrub needs a path parallel to `updateSong`, not a variant of it.

## 3. Vocabulary this effort adds

Add to `apps/boop/CONTEXT.md`:

- **Bar** — a quarter of a clip: 4 steps. A position is 4 bars.
- **Global bar** — a position on the whole song's timeline, `position × 4 +
  bar`. The song's own unit of "where we are". A 16-position song is 64 global
  bars; the demo's 8 placed positions are 32.
- **Scrub** — moving the playhead by gesture. A view change, never an edit
  (§2).

Bars are new to the codebase: the engine counts ticks and 16-step patterns, and
`song.ts` knows positions and clips. Neither knows what a bar is.

## 4. Behaviour

| Gesture | Result |
|---|---|
| Tap the song strip | Jump the song there, snapped to the nearest bar |
| Drag the song strip | Continuous bar-snapped scrub; playback follows and is audible |
| Tap a ruler numeral | Jump to the start of that position |
| Tap or drag the clip rail | Move the playhead within the current clip's 16 steps, snapped to a step |
| Drag while stopped | Silent preview: playhead and under-playhead highlight move, nothing sounds |
| Release | Playback resumes from where it was dropped, if it was playing |

**Clamping.** Empty positions are not part of the timeline. The scrub clamps to
the last placed position — in a song with placements at 1–8 the strip's cells
9–16 are drawn (dimmed, per the handoff) but not reachable.

**Motion is hard-cut.** No transition on a bar or step change — the existing
playhead's rule, and why `prefers-reduced-motion` needs nothing.

**Keyboard.** Left/Right move one bar on the song strip, one step on the clip
rail; Home returns to the start of the song. Both are `role="slider"` with
`aria-valuemin` / `max` / `now` in bars (steps on the rail) and an
`aria-valuetext` of `Position 4, bar 2`.

## 5. Where the work lands

Four layers, none of which can be told where to go today.

**`SequencerEngine`** (ticket 01) — has `start()` / `stop()` / `songPos()` and
no seek. `songPos()` interpolates from a private tick-space `anchor`;
`nextTick` is the scheduler's counter. A seek sets both and drops pending
draws. See decision §7.1 for the audio already scheduled.

**The timeline** (ticket 02) — a new pure module owning the global-bar axis:
which positions are placed, how bars map to positions and back, clamping, and
the snap arithmetic both strips need. No React, no engine.

**`SongConductor`** (ticket 03) — advances monotonically: `scheduled` and
`sounding` are closure counters and the whole design is the step-15 swap. A
jump mid-slot has to reset both counters and re-`setPattern` for the target,
because the swap is no longer how the pattern got loaded.

**`HomePage`** (ticket 04) — holds `playingPosition: number | null`, set only
at draw time and nulled by `leaveSongMode`. It becomes a bar-resolution
position that outlives a stop, plus the scrub path of §2.

Then presentation: laptop (ticket 05) and phone (ticket 06).

## 6. Test fallout

The playhead no longer unmounts on stop, so:

- `HomePagePom.verifyPlayheadHidden()` asserts `toHaveCount(0)` and must become
  an opacity/state assertion.
- Anything asserting the position is `null` after a stop goes red — expect
  edits in `playhead.iwft.tsx` and `songPlayback.iwft.tsx`.

This is expected churn, not a regression. Land it with ticket 04, where the
behaviour actually flips.

## 7. Decisions

Made here from the handoff's open questions and the code's constraints. Flagged
for the spec owner to promote or veto before ticket 01 starts.

### 7.1 A seek accepts one lookahead of stale audio

`AudioDriver` can cancel pending *draws* (`cancelDraws()`) but has no way to
unschedule a `play()` already queued at a future `audioTime`. A seek therefore
has two options:

- **Accept it** (chosen). Up to one lookahead — ~0.1–0.15s, one or two
  sixteenths — of the pre-jump clip may still sound after the jump. The
  `AudioDriver` contract stays as it is.
- Widen `AudioDriver` with a cancel-scheduled-audio call. More faithful, and a
  real ADR 0024 amendment to the driver seam.

Chosen because the artefact is two sixteenths at the moment a child is actively
dragging — during which the design already expects a smear of audio — and
because widening the driver seam for it buys precision no 6-year-old will
notice. Ticket 01 records the amendment to ADR 0024 as a *narrowing* of the
engine (a new `seek`) rather than a change to the driver.

**Veto trigger:** if the by-ear check on ticket 01 finds the stale audio reads
as a stutter or a wrong note rather than a smear, widen the driver.

### 7.2 The phone song strip stays bar-snapped over the song's real length

The handoff flags this itself: the phone strip spans the *placed* positions (8
in the demo, so ~10.8px per bar) rather than all 16, because spanning 16 would
halve the bar step. At a full 16 positions the step drops to ~5px, which is
tight.

Build it as designed. The alternative — snapping the phone strip to positions
rather than bars — makes the two screens disagree about what a scrub does, for
a case (a full 16-position song on a phone) that no child has hit yet. If it
proves tight in the by-hand check, a follow-up ticket switches the phone to
position-snap; the timeline module (ticket 02) makes that a one-line change of
snap unit.

A consequence worth naming: the strip's segment count changes as placements
change, so its geometry is derived, not fixed.

### 7.3 The playhead is not persisted

Position is page-lifetime view state. It is not in the save format, not in a
share link, and a reload starts at the beginning. Persisting it would mean a
save-format change (ADR 0032) for something a child cannot see the value of.

## 8. Not in scope

Straight from the handoff's "Not designed here", plus one:

- Loop regions (play positions 3–7 only).
- Skip-back / skip-forward buttons.
- A numeric position field.
- Persisting the playhead (§7.3).
