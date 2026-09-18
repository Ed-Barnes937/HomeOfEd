# 12 - Tapping a folded pitched row opens it

**Status:** ready-for-agent
**Blocked by:** 08 (shares `PitchedLane.tsx` and `PhoneGrid.tsx`)

**Why this ticket exists:** Ed asked for it on 2026-09-18, looking at the phone
lane running locally. Today the 44x44 chevron is the *only* way to unfold a
pitched row - ticket 07 made the folded summary genuinely inert (`aria-hidden`,
no handlers, nothing focusable) so that painting is always a deliberate act.
That inertness is right for *painting*; it is wrong for *opening*. A six-year-old
who wants their marimba back taps the row, not a small chevron.

**What to build:** a tap or click anywhere on a folded pitched row's summary
expands that row. **All breakpoints** - desktop, tablet and phone share one
rule, because the folded row is one component.

**Expand only. Nothing is painted.** A folded row is ~64px tall, so its eight
pitches would be ~8px bands aimed at blind; painting on that tap was considered
and rejected (Ed's call). Once the lane is open the existing paint gestures take
over unchanged.

## The three things that must not break

1. **The chevron stays the accessible control.** It carries `aria-expanded` and
   the "Expand/Collapse the <name> row" label. The summary's tap is a pointer
   convenience on top - it must **not** add a second tab stop, a second
   screen-reader announcement, or a duplicate accessible name for the same
   action. Keep the summary out of the a11y tree and let the chevron speak for
   both, or make a deliberate case in the ADR for doing it another way.
2. **A swipe that starts on a folded row must still scroll the bar.** Ticket 08
   found the phone's deferred latch treats a lane column's first `pointermove`
   as proof of paint; the same trap applies here. Expand on the *tap* (the
   `onClick` path ticket 08 already established for deferred pointers), never on
   `pointerdown`, so a horizontal pan starting on a folded row pans as it does
   today. Pin this with a test - it is the regression a future refactor will
   reintroduce.
3. **Arrow keys still step over a folded row** (ticket 07) and the playhead
   still sweeps one. Neither changes.

## ADR

This reverses part of **ADR 0061**'s "the summary is read-only, nothing
focusable". Amend 0061 in place rather than writing a new ADR - the repo has
done this before (ADR 0024 was amended twice in this epic). Record that
read-only still holds for *painting*, and that opening is now a pointer
affordance on the whole row with the chevron unchanged as the labelled control.

Acceptance criteria:

- [ ] Tap/click a folded row's summary at any breakpoint and the lane expands;
      nothing is painted, at any step or pitch.
- [ ] A horizontal swipe beginning on a folded row scrolls the phone's step
      window and does **not** expand. Pinned by test.
- [ ] No new tab stop and no duplicate accessible name: the keyboard and
      screen-reader path is the chevron, exactly as today.
- [ ] Arrow-key traversal over a folded row and playhead sweep are unchanged.

## Comments
