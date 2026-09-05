# 26 - The CT harness has no viewport meta, so "mobile" tests lay out at 980px

**Status:** done (built on ticket-26-viewport-meta, 2026-09-05)
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

## Outcome

The meta went in - and the **doctype** with it, because the harness page had
neither, so it was rendering in quirks mode as well as at 980px. So did
`src/global.scss`: the app had **no** global stylesheet at all, so `body` kept
the UA's 8px margin in production as well as in the harness. Both entry points
import it now (`src/main.tsx` and `playwright/index.ts`). All three are the same
rule - the harness's page and the app's page stay in step - and it is recorded
as [ADR 0053](../../../docs/adr/0053-silt-the-ring-outranks-the-picker-on-a-phone.md).

Measured at a true 390px, both overflows had **one** cause, not two: `.app` is a
grid, a grid item's automatic minimum is its *min-content*, and the header - the
one row of chrome that can neither scroll nor wrap - had a min-content of 451px
(458px once the field-notes chip carries a two-digit count). That sized the auto
column, and the column sized the document: 451 + 8 = **459px against a 390px
viewport, the 69px behind the bottom bar**, and 458 + 8 = **466px, the 76px
behind the field-notes sheet**. The rail was never the culprit - it already has
`overflow-x: auto` and scrolls in place. The fix, all in the elements' own CSS
and none of it in the assertions:

- **`.header { min-width: 0 }` is the whole of the overflow fix** - the rule
  `.stage` already carried. It lets the header be narrower than its widest
  content, so the row gives instead of the document. Measured on its own it
  takes `scrollWidth` from 459 to 390.
- `.sceneName { flex: 1 1 0; min-width: 0 }` nominates *which* child gives: the
  header's one elastic word, which already ellipsized.
- The mobile padding and gaps (`.header` to `0.5rem`, `.headerButton` to
  `0.6rem` of side padding) fix **no overflow** - reverted alone, `scrollWidth`
  stays 390. They are there because a header squeezed to exactly its content
  leaves the scene name nothing to render into and starts clipping the button
  labels: they buy back the room that keeps the row legible once the row is
  allowed to be narrow. The 44px touch floor does not move and
  `verifyTouchTargetSize` still holds on every control.

A third, separate bug surfaced once the sheet was a true 390px wide rather than
466: the phone picker wraps, and its `auto` grid row handed it every row it
wanted - **231px of an 844px sheet**, which pushed the ring onto its 340px floor
and, on a shorter phone, left it 13px of room to draw 340px in. It is capped at
`max(64px, 18dvh)` and scrolls, exactly as its desktop column does; the ring is
now width-bound at 380px of a 390px sheet (0.975).

Two assertions were tuned against the 980px lie and were re-measured rather than
relaxed - both viewport heights, no thresholds touched:

- "a phone with little height to spare" 480 -> **810**. At a true 390px the
  height-bound-but-above-the-floor band is ~800-844; 810 draws a 353px ring.
- "a sheet with less room than the ring needs" 200 -> **480**. A true 390x480
  is already below the floor. 200 is not a phone: the panel's fixed chrome is
  244px, so nothing in the sheet could be laid out or tapped.

`verifyNoHorizontalPageOverflow` and `verifyRingFillsTheSheet(0.9)` are
untouched and pass on their original terms.

**Every other app has the same harness gap** - `apps/{boop,boids,espy,fridge,
hub,karesansui,sprout,wotd}/playwright/index.html` and
`templates/starter/playwright/index.html` all lack the meta. Out of scope here
(surgical); worth its own ticket, and the starter is the one that stops it
spreading to the next app.
