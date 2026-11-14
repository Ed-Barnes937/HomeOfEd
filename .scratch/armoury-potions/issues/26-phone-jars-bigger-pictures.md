# 26 - Bigger ingredient pictures on a phone

**Status:** done (merged into `armoury-potions` as 16ce8a0e; Ed approved the layout, E24; review 26-r1, its fix aa7dd966 read by the orchestrator)
**Type:** task
**Spec:** [../spec.md](../spec.md)
**Blocked by:** 16, 22 (both merged)
**Model:** sonnet
**Gate:** Ed looks at the before and after; then code review
**Dev port:** 3041

## Goal

On a 390x844 phone the pictures in the jars are 26 px (an 18 px solid disc
after the mask), too small for the art Ed will make. Give them about 48 px
with all nine jars still in view, by the route measured in
`../reviews/16-r1.md` (ruling 3a). Ed asked to see pictures before saying yes
(E21), so this ticket's first hand-off is a before and after.

## Scope

1. On a phone, on the Pours tab only, move the group's summary row with its
   lock ("Three", 42 px with its gap) out of the tab's body, and the full or
   mixed message (22 px) below the jars. The summary row belongs to the shared
   sheet (`src/shop/controls/Sheet.tsx`): add a per-group switch with a
   default that leaves every wand and sword group, and the potion's other
   groups, exactly as they are. The lock must stay reachable (say where it
   goes) and the summary must still be announced to a screen reader.
2. Spend the height on the jars: a picture of about 48 px (50 with a 4 px jar
   gap) with the label under it, 44 px targets, equal rows, nine jars in view
   at 390x844 empty, part full, full and mixed. At 375x667 a short scroll for
   the third row is accepted as today; say how much.
3. Desk is unchanged (64 px pictures).
4. Everything the picker's reviews settled stays: focus without scrolling the
   sheet on a tap, the shut jars described by the message, announcements.

## Proof

- The picker's and the phone's iwft suites updated and green; the wand shop's
  and smithy's suites untouched and green.
- Shots, before and after side by side, at 390x844 and 375x667 (empty, two
  in, full, mixed) and desk, in
  `.scratch/armoury-potions/shots/26/`, with one sheet `before-after.png`.

## Comments
