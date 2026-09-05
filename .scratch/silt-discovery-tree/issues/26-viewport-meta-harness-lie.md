# 26 - The CT harness has no viewport meta, so "mobile" tests lay out at 980px

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 25 (the reading line reworks the sheet's bottom band; fix the
overflow bugs against the final layout, not the one 25 is replacing)
**Source:** found during ticket 21 (2026-09-05) - the agent trialled the fix
and measured the fallout before reverting; the trap is documented in
`apps/silt/CLAUDE.md`.
**Spec:** test harness - `apps/silt/playwright/index.html`.

`apps/silt/playwright/index.html` carries no `<meta name="viewport">`, so
every mobile-project iwft actually lays out at Chromium's 980px fallback and
only *looks* like a phone. Real phones get the real layout; the tests do not.

Ticket 21's agent trialled adding the meta: its own ring assertions still pass
at a true 390px, but three pre-existing tests then fail on horizontal page
overflow the harness had been hiding - the rail overflows by ~69px and the
field-notes sheet by ~76px at 390px.

## Design

- Add `<meta name="viewport" content="width=device-width, initial-scale=1">`
  to the CT index.html (matching the app's real index.html).
- Fix the real overflow bugs it exposes (rail, field-notes sheet) so the
  no-horizontal-overflow assertions pass at a true 390px.
- Expect to re-measure any mobile assertions tuned at 980px.

## Tests

- The existing verifyNoHorizontalPageOverflow cases at a true 390px are the
  acceptance tests; every mobile iwft green under the corrected harness.
