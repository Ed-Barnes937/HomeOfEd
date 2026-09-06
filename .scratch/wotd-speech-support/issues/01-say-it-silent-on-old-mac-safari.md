# 01 - "Say it" silent on Safari 26.5, old Intel MacBook Air

**Status:** ready-for-agent
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
      failing Air)
- [ ] A browser with no voices at all never shows the button
- [ ] Browsers that work today are unchanged (including the playing state)
- [ ] Unit tests cover: no API, API + no voices, voices arriving late via
      `voiceschanged`, and the cancel-then-speak ordering

## Comments

**2026-09-06 (Ed):** repro environment corrected - Safari 26.5 on an old
Intel MacBook Air, not Chrome. Ticket rewritten: Chrome empty-voices theory
demoted, WebKit cancel-then-speak race promoted to prime suspect, and the
goal reframed from "hide on incompatible browsers" to "fix capable browsers,
hide only truly voiceless ones". No more info owed by the reporter.
