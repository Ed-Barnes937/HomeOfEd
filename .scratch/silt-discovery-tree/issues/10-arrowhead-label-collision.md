# 10 - Arrowheads hide behind outcome labels at some spoke angles

**Status:** ready-for-agent
**Type:** task
**Source:** PR #128 review feedback (Ed, 2026-09-04), with screenshot - tip's
ring, the `tip · stalk` label sitting on top of the arrowhead so the direction
of the edge is unreadable.
**Spec:** [../spec.md](../spec.md) §6 (edge kinds - the arrowhead carries the
meaning "this end is the product").

The outcome label is an HTML box centred on `outcomePoint` (0.62 along the
spoke, `ringGeometry.ts`); the arrowheads are SVG polygons at the spoke's ends
(`FieldNotesPanel.tsx:201-204`), underneath the HTML layer. On spokes near the
horizontal, the label's text box extends *along* the spoke and covers the
arrowhead; near-vertical spokes are fine because the box's short axis lies on
the line. The geometry module's own doc comment says a layout that can be wrong
is worth a vitest case - this is that case, unwritten.

## Design

Fix it in geometry, not with z-order (putting the arrow *over* the text just
inverts the collision):

- Add `labelPoint(point, textWidthEstimate)` to `ringGeometry.ts`: the outcome
  label offsets perpendicular to the spoke's unit vector `(ux, uy)` - i.e. by
  `(-uy, ux) * k` - with the sign chosen away from the ring's centre-line
  neighbour, so the label box clears the line and both arrowhead positions for
  every angle. Near-vertical spokes need little or no offset; scale `k` by
  `|ux|` so the twelve o'clock spoke keeps today's look.
- The product tiles ride with the label (they share its box today).
- Pure trig in the 0-100 box like everything else there, so it is a vitest
  case, not a screenshot.

## Tests

- ringGeometry: for a dense sweep of angles and a representative label width,
  the label box intersects neither the spoke segment beyond a tolerance nor a
  disc around each arrowhead tip. Pin one regression fixture at the
  screenshot's failing angle (roughly two o'clock).
- Existing panel tests stay green; no panelModel change expected.
