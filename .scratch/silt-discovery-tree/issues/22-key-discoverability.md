# 22 - The key exists but nobody finds it

**Status:** ready-for-agent
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
