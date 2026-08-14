# Assemble the spec

Type: task
Status: closed
Assignee: ed-barnes937
Blocked by: 01, 02, 03, 04, 05, 07, 09, 12

## Question

Fold the design handoff
(`docs/reference/design_handoff_clip_lanes/README.md`) and every decision on
this map into `.scratch/boop-loops/spec.md` — the destination. Include the
accessibility treatment (match the grid's arrow-key model — folded in during
charting, no ticket), the resolved open questions, and the ADR 0031 amendment
noted in [08](08-edited-definition.md). The spec is what `/to-tickets` and
`/implement` consume.

## Resolution

**2026-08-13 — done.** The spec is at
[`.scratch/boop-loops/spec.md`](../spec.md): the model and its limits, the
laptop deltas over the handoff, the tablet (variant E) and phone (variant B)
treatments, the "+ New clip" picker and eight-clip sample roster, New
boop/Clear grid/first-visit behaviour, lane reordering, the song-mode
conductor (with the draw-channel note), save format v2, share-link numbers
and revisit trigger, WAV export (whole song; an empty song exports the grid
clip), the grown "edited" definition, accessibility, motion, out-of-scope
items, and execution notes.

Two decisions the earlier tickets explicitly delegated to the spec were made
while assembling it:

- **Empty-song WAV export falls back to the grid clip's 4 bars** (ticket 06
  left the wording to the spec) — consistent with ADR 0032's "an empty song
  playing the grid clip is today's behaviour", so old boops export unchanged
  and the button is never disabled.
- **Delete clip sits beside Make a copy in the phone's slim clip header**
  (ticket 04 suggested it; the spec adopts it).

Also landed with the spec, as ticket 08 required: the **ADR 0031 amendment**
("edited" grows to "any mutation of the song"), appended to
[`docs/adr/0031-boop-saved-state-visibility.md`](../../../docs/adr/0031-boop-saved-state-visibility.md).
