# 19 - Tag chips move to the bottom middle of the entry

**Status:** ready-for-agent
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
