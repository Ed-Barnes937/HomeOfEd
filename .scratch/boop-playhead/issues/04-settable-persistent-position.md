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

**Status:** ready-for-agent

- [ ] The position is bar-resolution and survives `leaveSongMode` — stopping the
      song no longer erases where you were
- [ ] Playback still drives it from the draw channel only, with no early flash
      of the next clip (boop-loops ticket 16's rule holds)
- [ ] A scrub does **not** mark the boop edited: the saved-state chrome is
      unmoved by it (ADR 0031)
- [ ] A scrub does **not** stop playback, and playback continues from where it
      was dropped
- [ ] A scrub while stopped is silent and does not start the transport
- [ ] A scrub with no placements at all is a no-op, not a throw (ADR 0032's
      all-empty song has no conductor)
- [ ] Starting the song after a scrub begins from the scrubbed position, not
      from position 1 — this supersedes boop-loops ticket 16's "accepted limit"
      about resuming mid-pattern, so say so in that ticket's comments
- [ ] `verifyPlayheadHidden` replaced with a stopped-state assertion; the
      existing `.iwft` suites pass
- [ ] Whole-page coverage of the scrub-is-not-an-edit rule specifically — it is
      the effort's load-bearing rule and the easiest to regress
