# 21 - The ring on mobile: bigger, and the focused element labelled at the top

**Status:** ready-for-agent
**Type:** task
**Source:** local testing feedback (Ed, 2026-09-04) - "The graph looks poo on
mobile, can we make it bigger, add labels to the elements at the top."
**Spec:** [../spec.md](../spec.md) §6 (phone sheet).

The phone sheet caps the ring at `min(340px, 100vw)` and hides the outcome
words entirely (`.spokeOutcome { display: none }`), so a phone ring is a
340px circle of unlabelled tiles with no words anywhere - the centre name is
the only text.

## Design

- **Bigger**: let the ring take the sheet's full available width and a fair
  share of its height (the picker is `auto`-row; the ring row is `1fr` and can
  actually use it). Ring geometry is a 0-100 box scaled by the container, so
  this is CSS sizing, not geometry work.
- **Label at the top**: the focused element's name (and its tag chips, per
  ticket 19) render as a header band at the top of the ring area on the phone
  sheet, instead of only in the ring centre where 340px makes it cramped.
- Do not re-add per-spoke outcome words on the phone - that is ticket 20's
  research question; keep this ticket to size and the header band.
- Spoiler policy untouched (names shown are the focused, discovered element's).

## Tests

- mobile iwft: ring occupies (say) >= 90% of viewport width at a real phone
  size; the header band shows the focused element's name at the top; tiles
  keep their non-overlap guarantees at the larger size (geometry is
  proportional, so this should hold by construction - pin it anyway).
