# 22 - The key exists but nobody finds it

**Status:** done (built on worktree-agent-a37b25e7a075db3e0, 2026-09-05)
**Type:** task
**Source:** local testing feedback (Ed, 2026-09-04) - "Not sure what happened
to the key showing what the types of arrows are?" Diagnosis: NOT a regression.
Ticket 11's key is live, but it renders as a small lowercase "key" text button
in the ring footer, and the footer only exists once an element is focused.
The person who asked for the key could not find the key.
**Spec:** [../spec.md](../spec.md) §6; ticket 11 built the legend.

## Design

- Make the toggle legible as a control: proper chip styling (like `forget
  discoveries` / the counter chips), capitalised label ("Key"), and consider
  an icon or `?`.
- Consider showing the toggle whenever the panel is open rather than only
  with a focused ring - the legend explains the chart's language, which the
  picker's tiles already speak. If it stays ring-only, that is defensible
  (11's original reasoning: no lines on screen, nothing to explain) - the
  implementer picks one and records it in the ticket; either way the control
  must be findable.
- First-open affordance: the first time a ring is shown per session, the key
  could open once by itself or the toggle could carry a subtle attention
  state. Optional - only if it does not fight the panel's calm.

## Tests

- iwft: with the panel open and a ring focused, the key toggle is visible at
  a real phone viewport without scrolling; opening it shows the legend rows.
- If the toggle becomes panel-wide: it is present before any element is
  focused.

## Built

**The call: ring-only, kept.** The key says nothing about tiles - every row it
holds is a *line* kind (reaction solid, decay long-dashed, growth dotted, the
arrowhead, the notch), and lines exist only on the ring. Panel-wide would put a
control on screen explaining marks that screen does not draw, which is the same
mistake the phone already refuses when it drops the notch row with the notches.
Ring-only is also not the same as "rarely there", and the source is stronger
than "once an element is focused" suggests: `focus` falls back to the first
*discovered* row, and the ten base elements are discovered from the start, so
the footer is on screen from the moment anything at all has been witnessed -
no element ever has to be picked for it. A player asking what the arrows mean
is by definition already looking at arrows.

**The finding was legibility, not availability** - and the ticket's own
diagnosis is half wrong on the detail: the toggle was never *lowercase* on
screen. The chrome uppercases its Silkscreen labels in CSS, so it read `KEY`
before and reads `KEY` now; capitalising the source string changed nothing a
player sees, and the tests assert `innerText`, not the source, for that reason.
What was actually wrong is size and position. The toggle
was an 8px uppercase chip sharing one CSS rule with `forget discoveries`, sat
*last* in the footer behind a strip of up to twenty-two still-to-find notches:
the destructive footnote set the size of the explanatory control, and the notch
tail decided where it landed.

What changed, and nothing else:

- The toggle now **leads** the footer's controls instead of trailing them, so
  the notch strip can never push it about.
- Its own rule, no longer shared with `forget`: 11px on the panel's raised
  paper, with a bordered `?` ahead of a capitalised "Key". `forget discoveries`
  stays the 8px footnote it should have been all along.
- The phone sheet gives it the full 44px touch target on **both** sides, not
  just the height it had.

**The first-open affordance was declined.** Auto-opening the key once a session
buys discoverability the styling already buys, and it costs the panel's calm
plus a module-level session flag - state in a component whose whole design is
that it remembers nothing (ticket 11). The `?` is the attention state.

Covered by two cases. `fieldNotes.iwft.tsx`: the rendered label carries the `?`,
the toggle leads the footer, and it **outsizes `forget discoveries`** - the one
measurement that states the thesis, since the two shared a rule and the
destructive footnote set the size. `mobile.iwft.tsx`: on screen without
scrolling, at a real 44px touch target, at 390x844. Both were red first - no
`?` in the rendered text, and the toggle trailing the notches - and the size
assertion is red against the old shared rule by construction.

"Leads the footer" is asserted as reading order rather than as `left` alone: the
phone's footer wraps, so a toggle that dropped to the line below the counter
would still be to its left while failing the point.
