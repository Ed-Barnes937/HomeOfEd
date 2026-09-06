# 01 - "Say it" silent on Safari 26.5, old Intel MacBook Air

**Status:** ready-for-human
**Type:** research
**Reported:** 2026-09-06, user bug report via Ed; repro environment confirmed
by Ed same day

On Ed's wife's MacBook Air (old Intel model, **Safari 26.5** - not Chrome as
first reported) the speak button did nothing. Works on Ed's machine. Ed's
ask: if we can detect incompatible browsers, hide the button on them - but
note the twist below: macOS Safari is a *capable* browser, so if this is a
WebKit quirk our code trips, the right fix is to make it play, not to hide
the button.

What the code already does: the button is hidden when the API is absent -
`WotdPage.tsx:189` returns null unless `speechSupported()`
(`features/speech/speak.ts:5`, checks `'speechSynthesis' in window`). Safari
has the API, so the failure is silent and downstream. `speak()` is
fire-and-forget; `onerror` only clears the playing state.

## Investigate (deliverable: diagnosis + proposal appended here, then a fix)

Likely culprits, in order for macOS Safari specifically:

1. **`cancel()` immediately before `speak()`** - `speak.ts:24` calls
   `window.speechSynthesis.cancel()` then `speak()` synchronously. This is a
   long-standing WebKit trap: a cancel can leave the queue in a state where
   the utterance queued in the same tick is dropped silently. Prime suspect
   because it is *our* line, not the browser's capability. Candidate fix:
   only cancel when `speaking || pending`, and/or queue the `speak()` a tick
   after the cancel.
2. **Stuck paused/pending state** - Safari's `speechSynthesis` can wedge with
   `paused: true` after an interrupted utterance; subsequent `speak()` calls
   queue forever. A `resume()` nudge is the classic workaround.
3. **`lang = 'en-GB'` voice resolution** (`speak.ts:18`) - if the Mac has no
   en-GB voice installed, browsers *should* fall back to default, but verify
   what old-Intel-Mac Safari actually does with an unmatched lang and no
   explicit `voice`.
4. **Empty voice list** - the original Chrome-flavoured theory. Less likely
   on macOS (system voices ship with the OS), but cheap to check while in
   there, and still worth guarding for genuinely voiceless browsers.

Diagnosis approach: `onerror` already fires `onEnd` - temporarily surface the
error code (dev logging) and, ideally, reproduce on a real Safari (BrowserStack
or the household Air). Establish whether *any* utterance ever starts
(`onstart`) or whether the queue silently swallows it.

Proposed shape, to validate during investigation:

- Fix the capable-browser path first (cancel-then-speak hardening, resume
  nudge) inside `speak.ts` - it stays the single seam, client-only.
- *Then* the hide-the-button rule for genuinely incapable browsers: API
  present but the voice list settles empty after `voiceschanged`. Do not
  flash the button in and out while voices load async.
- Extend `speak.test.ts`'s fake-API style: a fake that drops same-tick
  speak-after-cancel, a paused-state fake, an empty-voices fake.

## Acceptance (for the fix that follows the diagnosis)

- [ ] The word plays on macOS Safari (verified on a real Safari, ideally the
      failing Air) - **owed to Ed: the household Air is the only true repro**
- [x] A browser with no voices at all never shows the button (unit-covered;
      availability starts hidden and only ever flips to shown)
- [x] Browsers that work today are unchanged (including the playing state) -
      full iwft suite green, including both speak-button tests
- [x] Unit tests cover: no API, API + no voices, voices arriving late via
      `voiceschanged`, and the cancel-then-speak ordering

## Diagnosis (2026-09-06, agent)

### Feedback loop attempts

Real Safari 26.5 on the Intel Air is not reachable from this session (no
BrowserStack, and Ed's own Safari works, so it can't go red). Two probes were
run against Playwright's bundled WebKit 1.61.1 instead:

1. **Single-shot probe** - `speechSynthesis` present; `getVoices()` returns
   **0 voices synchronously**, settling to 68 only after `voiceschanged`.
   Plain speak and same-tick cancel-then-speak both played (start/end fired).
   Notably, a later `cancel()` fired a spurious `error:canceled` at an
   utterance that had **already ended** - so our `onerror → onEnd` wiring can
   fire twice per utterance under the current unconditional cancel.
2. **Stress probe** - 30 cancel-then-speak cycles at gaps of 0-900ms:
   22/30 started, the rest got `error:canceled` (interrupted), **zero fully
   silent drops**. Modern WebKit does not reproduce the symptom; consistent
   with "works on Ed's machine".

Conclusion: the silent drop is specific to the older macOS speech stack /
slower hardware, and the only red-capable seam available to an agent is a
unit-test fake that models the documented WebKit failure semantics (as this
ticket proposed). The real-Safari verification on the Air stays a human step.

### Ranked hypotheses

1. **CONFIRMED AS PRIME (by elimination + documented behaviour):
   unconditional `cancel()` before `speak()` on an idle queue** (`speak.ts:24`).
   On the first click nothing is in flight, so the cancel is pure poison: the
   long-standing WebKit trap where an utterance queued in the same tick as a
   cancel is dropped with **no events at all** - which matches the exact
   symptom (button does nothing, playing state never engages, `onerror` never
   fires so no state to surface). Prediction: only cancelling when
   `speaking || pending` makes the first click play on the Air, and is a
   no-op change on browsers where cancel-on-idle was already harmless.
2. **Stuck `paused` wedge** - would present as "worked once, then never
   again", not "never works", so it is not the primary cause; but it is the
   documented follow-on failure once utterances get interrupted, and the
   `resume()` nudge guarding it is free. Prediction: `paused === true` on the
   wedged machine; `resume()` before `speak()` unblocks it.
3. **`lang = 'en-GB'` with no matching voice** - demoted: macOS ships GB
   voices with the OS, and WebKit falls back to the default voice for an
   unmatched lang rather than erroring silently.
4. **Empty voice list** - refuted as the cause here (macOS has system
   voices), but it defines the *genuinely voiceless* class the hide rule is
   for. Probe 1 shows the list is empty-then-populated even on capable
   WebKit, so any hide rule must wait for `voiceschanged`, not trust the
   initial snapshot.

### Rejected fix: defer `speak()` a tick after `cancel()`

Research note: Safari ties speech playback to the user-gesture context; a
`setTimeout`-deferred `speak()` can fall outside it and go silent (the
classic iOS failure). The ticket's "queue the speak a tick after the cancel"
candidate would trade one silent failure for another. The conditional cancel
keeps `speak()` synchronous inside the click handler.

### Proposal (implemented below this diagnosis)

- **`speak.ts`**: cancel only when `synth.speaking || synth.pending`
  (fixes the first-click drop, and also removes the spurious
  `error:canceled` → double `onEnd` path probe 1 exposed); nudge with
  `resume()` when `synth.paused` (hypothesis 2's wedge). `speak()` stays
  synchronous in the gesture.
- **Residual risk, accepted**: a click *while a word is playing* still does
  cancel-then-speak in one tick; on the affected WebKit that restart may be
  dropped once, and the next click plays (queue now idle). Degraded but
  recoverable, versus never-plays today; fixing it would need utterance
  bookkeeping that isn't warranted for "replay the same word mid-play".
- **Hide rule**: the button now renders only when the API exists **and** the
  voice list is non-empty - checked once per page via a small tracker that
  starts hidden, listens to `voiceschanged`, and flips to shown when voices
  appear (monotonic hidden→shown, so no in-and-out flashing; a genuinely
  voiceless browser simply never shows it). Trade-off noted: a browser with
  the ancient Safari-15.4-era bug (speaks fine but reports zero voices
  forever) would lose the button - accepted per this ticket's own rule.
- **Tests**: fakes per the ticket - a WebKit-semantics fake that drops
  same-tick speak-after-cancel-while-idle (the regression test for the bug),
  a paused-state fake, and empty/late-voices fakes for the tracker.

## Comments

**2026-09-06 (agent):** diagnosed and fixed on branch `wotd-say-it-safari`.
`speak()` now cancels only when `speaking || pending` and nudges `resume()`
when wedged paused; the button is gated on `useSpeechAvailable()` (API +
voice list non-empty, listening for `voiceschanged`) instead of bare
`speechSupported()`. Hand back to Ed for the one un-automatable step: click
"Hear it" on the household Air's Safari 26.5. If it is *still* silent there,
the next hypothesis to chase is the stuck-paused wedge surviving page loads
(check `speechSynthesis.paused` in the Air's console before any click).

**2026-09-06 (Ed):** repro environment corrected - Safari 26.5 on an old
Intel MacBook Air, not Chrome. Ticket rewritten: Chrome empty-voices theory
demoted, WebKit cancel-then-speak race promoted to prime suspect, and the
goal reframed from "hide on incompatible browsers" to "fix capable browsers,
hide only truly voiceless ones". No more info owed by the reporter.
