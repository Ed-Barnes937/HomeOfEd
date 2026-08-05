# 01 — Hub: Silt "coming soon" card

**What to build:** A new card on the homeofed.com home page for Silt. It shows
a small looping falling-sand canvas animation (a new preview kind alongside
the existing boids/ink/garden drawers — grains falling and piling reads as
"Silt" at a glance), the app name, and the `SOON` label. The card is not a
link. It follows the hub's existing card pattern: `SOON` entries render
unlinked and the preview animation recolours with the hub's light/dark theme
toggle without restarting.

Spec: `.scratch/sand-sim/spec.md` (product summary only — this ticket touches
the hub, not Silt itself).

**Blocked by:** None — can start immediately

**Status:** claimed

- [ ] Silt appears in the hub's app gallery with a `SOON` label and no link
- [ ] The card carries a looping falling-sand canvas animation in the style of the existing previews
- [ ] The animation tracks the theme toggle (recolours without restarting) and respects the existing preview lifecycle (starts on mount, stops on unmount)
- [ ] Hub tests stay green (`pnpm lint`, `pnpm typecheck`, hub test suite)
