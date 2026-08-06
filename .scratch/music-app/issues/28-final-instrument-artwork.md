# 28 — Final instrument artwork

**What to build:** The real six-character artwork set replacing the
game-icons.net CC BY placeholders. The design handoff
(`docs/reference/boop-design/README.md`, Assets) is explicit that the
placeholders do not satisfy the brief: at 18px inside a phone cell line art
turns to mush, which is why the phone note mark is currently a bare coloured
pebble.

Per character (Kick, Snare, Hi-hat, Tom, Marimba, Boop), two crops of the
same character:

1. A **detailed form** for 40–64px row labels.
2. A **single-silhouette form** — one closed shape, no interior lines,
   recognisable at 18px — for the note mark.

Six characters with shared DNA, distinguishable by outline alone. Never
emoji, never abstract icons. Delivered as `currentColor`/mask-friendly SVGs
so they tint to the row colours.

**Blocked by:** None to *start* (it's an art commission/design task, can run
any time) — but ticket 26 (remove "Coming soon") is blocked on it landing.
If V1 ships with the placeholders instead, the CC BY attribution must ship
with them and this ticket stays open.

**Status:** ready-for-human

- [ ] Six characters, two crops each, per the handoff's requirements
- [ ] Silhouette forms legible at 18px; detailed forms sing at 40–64px
- [ ] Mask/`currentColor`-friendly SVGs, tintable to the row hues
- [ ] Wired into the kit manifest, replacing the placeholders and their
      attribution requirement
- [ ] Phone note mark upgraded from plain pebble to the silhouette form

## Comments

2026-08-06 (orchestrator): **owner decision — V1 launches on the
attributed placeholders.** Per this ticket's own clause: the CC BY
attribution ships with them (already in
`apps/boop/public/kits/launch/ATTRIBUTION.txt`) and this ticket stays
open for the real artwork. This unblocks ticket 26's artwork gate.
