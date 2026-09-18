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

- [x] Tap/click a folded row's summary at any breakpoint and the lane expands;
      nothing is painted, at any step or pitch.
- [x] A horizontal swipe beginning on a folded row scrolls the phone's step
      window and does **not** expand. Pinned by test.
- [x] No new tab stop and no duplicate accessible name: the keyboard and
      screen-reader path is the chevron, exactly as today.
- [x] Arrow-key traversal over a folded row and playhead sweep are unchanged.

## Comments

**2026-09-18 - built. ADR 0061 amended in place.**

`LaneSummary` takes an `onExpand` and hangs it off the strip's own `onClick`.
Both renderers pass `collapsedRows.toggle`, so desktop, tablet and phone share
the one rule the ticket asked for. Eight lines of component, one `cursor:
pointer`.

**The swipe trap, and why the test looks the way it does.** The handler is an
`onClick` because a pan the browser claims (`touch-action: pan-x`, ADR 0027 §3)
arrives as `pointerdown` + moves + `pointercancel` and **never a click** - so
there is nothing to suppress, and the row simply does not open. Playwright
cannot drive that with `page.mouse`: a mouse down-move-up inside the summary
fires a real `click` on the common ancestor, which is not what a phone does, so
a mouse-drag test would fail on a gesture that is correct in the browser. The
POM's `panAcrossFoldedRow` therefore dispatches the sequence the browser really
delivers, and the test then does a real wheel `swipeSteps(300)` and asserts the
window landed on 308 with the row still folded. **Mutation-checked:** swapping
the handler to `onPointerDown` turns that one test red and nothing else.

**A11y.** The summary keeps `aria-hidden="true"` and has nothing focusable in
it, so nothing new reaches the tree - a div with a click handler and no
`tabindex` is not a tab stop. `verifyFoldedRowIsOneControl` pins all three
halves: the `aria-hidden`, zero `button|a|input|[tabindex]|[role]` descendants,
and exactly one button named "Expand the Marimba row" on the page. Arrow-key
step-over and the playhead sweep are untouched and their ticket-07 tests still
pass unchanged.

**One existing test had to change**, which is the ticket's point: the old "the
summary is read-only: a tap on it paints nothing" clicked a summary cell and
then used the chevron to reopen the row. That now reads as two taps. It split
into the read-only/arrow-traversal half (unchanged assertions) and a new tap
test that opens the row and checks all eight pitches at the tapped step are
still off.

**Surprise worth recording:** none in the mechanism - `useDragPaint` never sees
the summary at all, so nothing in the paint latch needed touching. The only
real decision was the test shape above.

**For Ed, on real touch hardware:** that a pan starting on a folded row still
reaches bar 3 rather than unfolding the row, and that a deliberate tap on the
pebbles opens it first time. The `cursor: pointer` is desktop-only dressing.

**2026-09-18 - fresh-context review round.**

One real find, and it was in the a11y pin rather than the feature.
`verifyFoldedRowIsOneControl` only walked the summary's *descendants*, so a
`tabIndex={0}` added to the summary root itself - exactly the "let's make it
focusable too" regression criterion 3 exists to stop - slipped through green.
It now asserts `tabindex` and `role` on the summary element as well;
mutation-checked, and that mutation turns both the desktop and the phone test
red.

Two nits taken: `useCollapsedRows` gained an idempotent `expand`, so the prop
named `onExpand` is one, rather than a `toggle` whose correctness rests on
`LaneSummary` only ever being mounted while folded; and a test now taps a
**pebble** rather than an empty track, which is the thing a child is actually
aiming at. A prose section header in `pitchedLane.iwft.tsx` was trimmed to a
line.
