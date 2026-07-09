# 0021 — karesansui: aggressively minimal console (the strip)

- **Status:** Accepted
- **Date:** 2026-07-09
- **Related:** **supersedes in part**
  [0019-karesansui-architectural-redesign.md](0019-karesansui-architectural-redesign.md)
  §controls (the hybrid picker/toggle/`Tune ▾`/`SavedTray` console);
  [0020-karesansui-many-pens-model.md](0020-karesansui-many-pens-model.md) §controls
  (the control *set* is unchanged — only its presentation changes). Design source:
  the "Architectural framing" (Direction C) spike in the layout-spikes artifact.

## Context

The Direction C redesign (ADR 0019) already made the room a dark, spotlit stage
with the two bowls as heroes and the controls dimmed into a bottom console. But
that console still carried full chrome: a segmented ring picker, a wheel dock with
chips, pill toggle switches, a `Tune ▾` popover hiding the offset/speed sliders,
and boxed action buttons. Against the quiet stage the boxes read as busy.

The Direction C spike itself pointed further: a single flat **strip** of bare
`LABEL value` pairs, dividers between groups, and one amber `▸ Play`. This ADR
adopts that — the controls recede to text so the bowls carry the screen.

## Decision

1. **One strip, no boxes.** The console is a single centered, wrapping row. Every
   control is a bare `LABEL value` pair (shared `Strip.module.scss`): muted amber-
   grey at ~0.72 opacity, brightening to full on hover / keyboard focus, `1px`
   dividers (`divit`) between groups. The whole strip still rests dimmed and lifts
   on `:focus-within` (the D8 reveal from ADR 0019 is kept).
2. **Multi-option controls collapse to one control.**
   - **Ring** → `StripCycle`: click cycles 96 → 120 → 144.
   - **Rake** / **Preview** → `StripCycle` as a `switch` (`on` ↔ `off`,
     `aria-checked`).
   - **Cogs** → `CogDots`: one gear-coloured dot per cog (click to remove, last
     locked), plus a `+` to add (hidden at `MAX_GEARS`). Adding auto-picks the
     next teeth from the wheel palette — the strip has **no per-cog teeth picker**
     (a deliberate loss of that fine control for the sake of the minimal surface).
3. **Continuous values reveal a hairline slider.** `StripRange` (Offset, Speed)
   reads `LABEL value`; clicking reveals a 1px-track slider in a small popover
   beneath (no permanent track in the strip, no reflow). A real disclosure:
   Escape / outside-click close, focus moves into the slider on open. Speed reads
   as a word (`slow`/`steady`/`brisk`) over its continuous value; offset reads
   `0.66` (the `r` suffix is dropped).
4. **Actions are text, one accent.** `▸ Play` is bare amber text (the console's
   only accent); `Clear · Save · ↓` are dim text links; `Presets ▾` is a text link
   opening the existing menu. No button boxes.
5. **`Tune ▾` and the wheel dock are removed.** Offset and speed are first-class
   strip items, so hiding them behind a disclosure is gone.

## Consequences

- The console reads at a glance and competes far less with the bowls; the page is
  pulled fully into the Direction C minimalism.
- **Retired components:** `RingPicker`, `GearTrain`, `TunePopover`, `Slider`,
  `PreviewToggle`, `ClearingRakeToggle` and their styles. **New:** `StripCycle`,
  `StripRange`, `CogDots`, shared `Strip.module.scss`. `ActionButtons` and
  `PresetsMenu` keep their props/testids but restyle to text.
- **Lost capability:** you can no longer choose a specific tooth count per cog;
  the `+` auto-assigns. Presets, the many-pens model, and the engine are untouched.
- Every control stays a real, keyboard-operable element (cycle buttons announce
  via `aria-label`; toggles are `switch`es; the hairline sliders are native
  ranges) — minimal look, full accessibility.
