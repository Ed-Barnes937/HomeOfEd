# 29 — Centre the column on wide screens

**Reported:** V1 feedback (Ed, 2026-08-07) — on a large monitor the app sits in
the top-left and leaves a large empty band down the right-hand side.

**Why it happens:** every laptop-breakpoint number in the design handoff (§1) is
a fixed pixel value — rail 160px, cell 62px, 8px inner gap, 18px group gutter —
so the grid well is a fixed width whatever the viewport is. `.stage`
(`HomePage.module.scss`) has `padding: 0 36px 32px` and **no `max-width` and no
centring**, so all the slack lands on the right.

**Decision (grilled 2026-08-07):** centre the fixed column. The handoff calls
its geometry final and exact; centring needs no amendment and no re-derivation
of the playhead-column maths. Scaling cells up above 1440px was considered and
rejected — it would add a number set the handoff does not define.

**What to build:** an inner wrapper inside `.stage` with
`max-width: 1356px; margin-inline: auto`, holding the existing stack.

**The 1356px is derived, not eyeballed:**
```
rail 160 + railGap 18
+ steps 1142  (4 groups × (4×62 + 3×8) = 1088, + 3 gutters × 18 = 54)
+ well padding 2 × 18
= 1356
```
With `.stage`'s 36px side padding that is the 1440 the handoff was drawn at, so
nothing changes at or below 1440px.

**Note for ticket 33:** the sticky bottom bar that lands later is **full-bleed**
with its *contents* aligned to this same 1356px column (grilled: a pinned bar
that stops short of the window edges reads as a floating toolbar). Build the
wrapper so a full-width bar can align to it — i.e. the max-width lives on a
reusable wrapper, not baked once into `.stage`.

**Blocked by:** — (ships first, straight to main)

**Status:** ready-for-agent

- [ ] Column centred above 1440px; layout byte-identical at and below 1440px
- [ ] Tablet (1024–1279) and phone (<1024) paths untouched
- [ ] The centring wrapper is reusable by a full-bleed bar aligning to it
- [ ] Whole-frontend test at 2560×1440 asserting the grid well is centred
