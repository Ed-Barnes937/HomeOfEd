# 04 — The song's position is settable and survives a stop

**What to build:** The behaviour of the whole effort, in `HomePage`, with no new
visuals. After this ticket the position can be set from code and outlives a
stop; tickets 05 and 06 give it something to grab.

Two changes.

**The position gets bar resolution and a longer life.** `playingPosition:
number | null` is set only by `onSoundingPosition` at draw time and nulled by
`leaveSongMode`. It becomes a bar-resolution position that survives the stop —
spec §1's "a persistent fact rather than a playback artefact". Draw time still
drives it during playback; what changes is that stopping no longer erases it.
A position of `null` now means only "there is nothing to point at" (no
placements at all), not "we are stopped".

**Scrub gets its own path.** Not a variant of `updateSong` — a sibling of it.
Read spec §2 before writing it: a scrub must not `markEdited` and must not stop
playback, and every other write to the song does both. Concretely it calls the
conductor's `seek` (ticket 03) or, with no conductor, the engine's (ticket 01),
and sets the position state. It touches `songRef` not at all, because the song
has not changed.

While stopped a scrub is silent: the state moves, the transport does not start.
Release resumes only if it was playing when the drag began — so the gesture
needs to remember that, which is the drag hook's business in tickets 05/06, not
this one's.

**Expect test churn** (spec §6). `HomePagePom.verifyPlayheadHidden()` asserts
`toHaveCount(0)`; the playhead no longer unmounts, so the helper becomes a
stopped-state assertion, and `playhead.iwft.tsx` / `songPlayback.iwft.tsx` need
edits. Do it here, where the behaviour flips, rather than leaving it for 05.

Spec: §2, §4 (release behaviour), §5 (HomePage), §6.

**Blocked by:** 03

**Status:** resolved — the deferred box was delivered by ticket 05 for
the reason in the comments, and that deferral wants a human's nod

- [x] The position is bar-resolution and survives `leaveSongMode` — stopping the
      song no longer erases where you were
- [x] Playback still drives it from the draw channel only, with no early flash
      of the next clip (boop-loops ticket 16's rule holds)
- [x] A scrub does **not** mark the boop edited: the saved-state chrome is
      unmoved by it (ADR 0031)
- [x] A scrub does **not** stop playback, and playback continues from where it
      was dropped
- [x] A scrub while stopped is silent and does not start the transport
- [x] A scrub with no placements at all is a no-op, not a throw (ADR 0032's
      all-empty song has no conductor)
- [x] Starting the song after a scrub begins from the scrubbed position, not
      from position 1 — this supersedes boop-loops ticket 16's "accepted limit"
      about resuming mid-pattern, so say so in that ticket's comments
- [x] `verifyPlayheadHidden` replaced with a stopped-state assertion; the
      existing `.iwft` suites pass
- [x] Whole-page coverage of the scrub-is-not-an-edit rule specifically — it is
      the effort's load-bearing rule and the easiest to regress
      — **deferred to ticket 05**, which landed it in `playheadStrips.iwft.tsx`
      ("a scrub is listening, not editing"); ticket 06 added the phone's own in
      `phoneStrips.iwft.tsx`

## Comments

**2026-08-17 (agent)** — Implemented.

- `song/songScrub.ts` — `scrubToBar(target, globalBar)`: the whole of what a
  scrub does, which is a seek and nothing else. Through the conductor when the
  song plays, through the engine when it does not, `null` on an empty timeline.
  Unit suite `songScrub.test.ts` against the real engine and a real conductor:
  playing scrub keeps playing, stopped scrub is silent and starts nothing, the
  scrubbed bar sounds on the next `start()`, empty timeline is a no-op, clamps.
- `HomePage` — `playingPosition` state is gone. In its place `songBar` (global
  bars) plus the timeline derived each render, and `playheadBar` / `playheadAt`
  clamped to the song as it stands, so a placement change cannot leave the marker
  drifting. Bar resolution during playback comes from a new `onDrawBeat`
  subscription (song mode only), never from schedule time. `scrubSongTo` is
  `updateSong`'s sibling: no `markEdited`, no `stopSongPlayback`, no `songRef`
  write. `toggleSong` sends the fresh conductor to the playhead before starting.
- The clip playhead no longer unmounts on a stop: it stays on the last step that
  sounded at `opacity: 0.45` (`data-playing` on `.playhead`, both grid
  renderers). It is the *clip's* step, not the song's bar — an early draft used
  the bar and made a paused clip loop jump backwards to the start of its bar,
  which is wrong: clip play has its own position. `null` now means only "nothing
  has sounded yet", which is what `verifyPlayheadHidden` asserts.
- Test churn as spec §6 predicted, in both files it named:
  `verifyPlayheadStoppedAtStep` is the new stopped-state assertion and
  `verifyPlayheadAtStep` also asserts the playing state. `playhead.iwft`'s pause
  case and `songPlayback.iwft`'s all-empty stop both moved to it. The phone
  suites needed nothing: they never crank a step before asserting.
- The 45% opacity itself is ticket 05's row, taken early: without it a stopped
  playhead would be indistinguishable from a playing one the moment it stopped
  unmounting, and spec §1 gives the number. Nothing else visual moved.

**The one deferred box.** The scrub-is-not-an-edit rule is covered at unit level
now, but *whole-page* coverage needs a gesture, and every gesture in the design
belongs to tickets 05/06 — the song strip, the interactive ruler numerals, the
clip rail. Wiring one of them early would have meant landing part of 05's
geometry and a11y treatment here. So ticket 05 owns the `.iwft` test that taps
the strip and asserts the saved-state chrome is unmoved and playback carries on;
its checklist now carries that row.

**Notes for ticket 05.**

- The playhead state is bar-resolution, as this ticket specified. The clip rail
  scrubs in *steps*, so 05 either widens `songBar` to step resolution (a global
  step, `tick`-shaped, with the bar as `floor(step / 4)`) or carries the step
  within the bar alongside it. Nothing else here assumes bars.
- A stopped scrub does not move the grid's playhead column yet, because the
  column follows the clip's own last sounded step and only the clip rail (05)
  scrubs in that unit. Whichever way 05 widens the state, the column should read
  from it so the "silent preview" of spec §4 moves both.
