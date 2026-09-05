# 19 - Tag chips move to the bottom middle of the entry

**Status:** absorbed into 25 (Ed's ruling, 2026-09-05) - the chips move into
the same bottom band as 25's reading line, with the stack order decided there
**Type:** task
**Source:** local testing feedback (Ed, 2026-09-04, post tickets 08-16) - "can
we move the tags in the element field notes to the bottom middle?"
**Spec:** [../spec.md](../spec.md) §6; ticket 12 built the chips.

Ticket 12 hung the chips a fixed 55px under the centre name, inside the ring -
where they crowd the centre on busy rings and sit at an arbitrary offset that
does not scale (the mobile iwft already has to pin them clear of spoke tiles).
Ed's ruling: bottom middle of the entry.

## Design

- Move the chips out of the ring's coordinate space entirely: render them as a
  centred row at the bottom of the ring area (above the footer bar), in normal
  document flow. This deletes the 55px magic offset and its non-scaling
  problem outright - the mobile clearance test becomes trivial.
- Chips content, allowlist, masking (via refOf) all unchanged - this is
  placement only.
- Desktop and phone sheet both get the same centred-bottom row.

## Tests

- Adjust the existing iwft/mobile assertions from "clear of the spoke tiles at
  55px" to "chips render in the bottom band, horizontally centred".
- panelModel tests untouched (no data change).

## Landed here (2026-09-05)

Built as part of ticket 25, on branch `ticket-25-reading-line`: the chips left
the ring's coordinate space and the 55px offset with it, and now sit as the
first row of the bottom band, above the reading line - the stack order 25
decided (chips describe the ELEMENT, the line describes the SPOKE).

One deviation from the design above: the chips row is **left-aligned**, not
centred. It shares a left edge with the reading line under it so the two read
as one band; "horizontally centred" was written for a chips row with nothing
beneath it. The mobile clearance test became trivial exactly as predicted - it
is now `verifyBottomBandOrder`, which asserts the chips are out of the ring
entirely rather than measuring a px offset against the spoke tiles.
