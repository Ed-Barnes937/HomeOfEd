# 01 - "Say it" silent on an older laptop's Chrome; detect and hide

**Status:** ready-for-agent
**Type:** research
**Reported:** 2026-09-06, user bug report via Ed

On Ed's wife's older laptop (Chrome, exact OS/version unknown - **info
requested from Ed**, but do not block on it) the speak button did nothing.
Works on Ed's machine. Ed's ask: if we can detect incompatible browsers, hide
the button on them.

What the code already does: the button is hidden when the API is absent -
`WotdPage.tsx:189` returns null unless `speechSupported()`
(`features/speech/speak.ts:5`, checks `'speechSynthesis' in window`). So the
failing laptop almost certainly *has* the API and fails silently downstream.
`speak()` is fire-and-forget; `onerror` only clears the playing state.

## Investigate (deliverable: diagnosis + proposal appended here, then a fix)

Likely culprits, roughly in order:

1. **Empty voice list.** `speechSynthesis.getVoices()` returns `[]` on
   Chrome/Linux without local TTS voices, on de-Googled Chromium builds, and
   transiently on Chrome everywhere (voices load async; `voiceschanged`
   fires later). `speak()` with no voice available silently does nothing on
   some builds. This is the prime suspect and the detectable one.
2. **Utterance error events** (`not-allowed`, `synthesis-failed`) - we
   swallow them apart from clearing the spinner. Worth logging in dev to see
   what the field failure actually is.
3. Old-Chrome quirks (the historic 15-second utterance bug etc.) - less
   likely for one short word.

Proposed shape of the fix, to validate during investigation:

- Extend the support check to "API present **and** the voice list is
  non-empty once known": listen for `voiceschanged`, hide (or never show)
  the button when the list settles empty. Beware the async trap - do not
  flash the button in and out; showing it only after a non-empty
  `getVoices()` on Chrome, immediately on first call elsewhere, is fine for
  a progressive-enhancement button.
- Keep it client-only; the seam stays `speak.ts` and its existing unit-test
  style (`speak.test.ts` fakes the API - add an empty-voices fake).

## Acceptance (for the fix that follows the diagnosis)

- [ ] A browser whose voice list is empty never shows the button
- [ ] A browser with voices behaves exactly as today (including the playing
      state)
- [ ] Unit tests cover: no API, API + no voices, voices arriving late via
      `voiceschanged`

## Comments
