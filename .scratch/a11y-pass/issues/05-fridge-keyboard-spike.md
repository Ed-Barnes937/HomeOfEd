# 05 - Spike: keyboard access for fridge magnets

**Status:** ready-for-agent
**Type:** prototype
**Spec:** [../spec.md](../spec.md) §5

Fridge magnets are plain `<div>`s with pointer handlers only
(`apps/fridge/src/features/board/MagnetView.tsx:73-81`): no `tabIndex`, no
`role`, no `aria-label`, no `onKeyDown`. The core verbs - place, drag (with
physics bumping), rotate, remove - are all pointer-only, and the instructions
say so ("drag to bump - click to rotate - double-click to remove",
`TopBar.tsx:60`). For a child who cannot use a mouse the app's entire purpose
is unreachable (WCAG 2.1.1). The toolbar/tray is fine (real buttons).

This is a **spike, not a build**: answer the design question, throw the code
away.

## The question

What should keyboard-driven magnet interaction feel like, and is it buildable
without distorting the pointer experience?

Sub-questions the answer must cover:

1. **Focus model** - how does focus move between ~dozens of magnets on a 2D
   board? Roving tabindex with arrow-key spatial navigation? One tab stop for
   the board with arrows moving a cursor? What do kids' apps and
   drag-and-drop ARIA patterns (e.g. the WAI-ARIA drag alternatives:
   pick-up / move / drop) do here?
2. **The verbs** - a concrete key mapping for pick up, move (in steps?
   which granularity?), drop, rotate, remove. Does keyboard movement drive
   the same `relax()` bump physics (`packages/magnet-kit/src/relax.ts:35-62`
   runs per pointer event today, so per-keypress is plausibly free)?
3. **Placement from the tray** - the tray-to-board flow without a drag.
4. **Announcements** - what a screen reader should say on pick-up/move/drop
   (live region contents), even if full SR support is a later ticket.
5. **Cost & seams** - what the real build would touch (`MagnetView`,
   `FridgeDoor`, `useFridgeBoard` reducer, instructions copy) and roughly how
   big it is.

## Approach

- Read `useFridgeBoard.ts` first - the reducer already models the verbs as
  actions, so the spike is mostly "can a keyboard synthesise the same
  actions", which is promising.
- Prototype the one genuinely uncertain piece (spatial focus + pick-up/move
  with live physics) as a throwaway on a branch; do not polish, do not test,
  do not merge.
- A short desk-review of prior art counts as evidence: ARIA APG's grid /
  drag-drop guidance, and any kids' board-style app with keyboard support.

## Answer format

Append under `## Answer` here: the recommended interaction model (keys +
focus model), what the prototype proved or disproved, screenshots/gif if
useful, the estimated build shape, and a go/no-go recommendation. If go, the
follow-up build ticket gets written then - not as part of this spike.

## Constraints

- Throwaway branch; nothing merges from this ticket.
- No changes to `packages/magnet-kit` even in the prototype if avoidable -
  the point is to test whether the existing seam is enough.
