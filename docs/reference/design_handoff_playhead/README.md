# Boop — controllable song playhead

Design handoff for two mocks: **1b** (laptop, ≥1280px) and **1d** (phone, ≤1023px).

## What's in this folder

| File | What it is |
|---|---|
| `boop-playhead-mockup.html` | Self-contained interactive mock. Open in a browser, no server needed. |
| `Boop Playhead Handoff.dc.html` | Source of the mock (needs `support.js` + `assets/` beside it). |
| `assets/` | Launch-kit artwork SVGs and the self-hosted Chivo / Chivo Mono woff2s, copied from `apps/boop/public/`. |

The mock runs a fake clock. Demo song: 3 clips (Slow bass, Clip 2, Tappy hats), 8 placed positions of the 16, 32 bars, 110 BPM. Both screens share one clock, so scrubbing either moves both.

## The problem

Today the song's position is output-only. `HomePage` holds `playingPosition: number | null`, set at draw time by `createSongConductor`'s `onSoundingPosition`, and `SongBar` renders it two ways: a cyan ruler numeral (`.rulerNumeral[data-playing]`) and a white ring on the sounding lane square (`.square[data-playing]`). Nothing is grabbable, and `stopSongPlayback` sets `playingPosition` back to `null`, so stopping erases where you were.

## What changes

1. A **dedicated playhead strip** in the song bar, above the ruler.
2. The song's position becomes **settable**, not just readable.
3. The playhead **survives a stop** at 45% opacity, so "where we are" is a persistent fact rather than a playback artefact.
4. The same treatment at **clip level**: a 16-step scrub rail in the grid well.

## Behaviour

| Gesture | Result |
|---|---|
| Tap a spot on the song strip | Jump the song there. Snaps to the nearest bar (4 of them per position). |
| Drag along the song strip | Continuous scrub, still bar-snapped. Playback follows; audio is audible while scrubbing. |
| Tap a ruler numeral | Jump to the start of that position. |
| Tap or drag the clip rail (grid well) | Move the playhead within the current clip's 16 steps. Snaps to a step. |
| Drag while stopped | Silent preview — the playhead and the grid's under-playhead highlight move, nothing sounds. |
| Release | Playback resumes from where you dropped it, if it was playing. |

Scrubbing is a *view* change, not an edit. It must not mark the boop edited (`markEdited`), and must not stop playback the way `updateSong` does — this is the one interaction with the song that is listening, not editing.

Empty positions (9–16 in the demo) are not part of the timeline; the scrub clamps to the last placed position.

## Laptop geometry (1b)

Everything aligns to the existing lane grid, so nothing new needs its own column maths.

**Song strip** — a row inserted as the first child of `.lanes`, above `.ruler`.

- Row height 26px, no extra gap (the `.lanes` 8px gap applies).
- Left inset **184px** — the same as `.ruler`'s `padding-left` (176px chip + 8px gap).
- Track: 16 cells × 56px on an 8px gap = **1016px** total, so each cell sits exactly under its ruler numeral and lane squares.
- Cell: `height: 12px; border-radius: 4px`.
  - Placed: that position's topmost clip tint at 32% alpha, `inset 0 1px 0 rgba(255,255,255,0.14)`.
  - Empty: `rgba(255,255,255,0.05)`, no inset.
- Label in the 184px inset: `Chivo 700 10px / letter-spacing 0.06em / rgba(242,239,230,0.38)`, copy `WHOLE SONG` — the loop map's label idiom.
- Playhead marker: 14px wide (one bar = 56 / 4), `top: 1px; bottom: 1px; border-radius: 4px`, `background: var(--cyan)`, `box-shadow: var(--shadow-loop-map-tick)`. Left offset = `position × 64 + bar × 14`.
- Marker opacity: **1** playing, **0.45** stopped. Hard cut on step change, no transition — the existing playhead's motion rule.

**Ruler** — unchanged geometry, now interactive.

- Numerals get `height: 18px; border-radius: 6px; line-height: 18px` and `cursor: pointer`.
- Current position: `background: rgba(111,224,240,0.12)`, colour `var(--cyan)` playing / `rgba(111,224,240,0.5)` stopped.
- Everything else stays `rgba(242,239,230,0.3)`.

**Clip rail** — a row in the grid well between `.barNumerals` and `.body`.

- `.barNumerals` bottom margin drops 8px → 4px; the rail row takes `margin-bottom: 8px`.
- Left inset 160px (the rail) + 18px gap, matching `.playhead`'s own `left` calc.
- Track 1142px: 4 groups of 4 × 62px on an 8px gap, 18px gutters — the `.steps` geometry exactly.
- Tick: `62 × 4px`, `border-radius: 2px`, `margin-top: 3px`.
  - Current step: `var(--cyan)` + `var(--shadow-loop-map-tick)`, at the same 1 / 0.45 opacity rule.
  - Otherwise `rgba(242,239,230,0.12)`.
- Label in the 160px inset: `THIS CLIP`, same 10px caption style as `WHOLE SONG`.
- The existing `.playhead` column is unchanged except that it no longer unmounts on stop: it renders at `opacity: 0.45`.

**Readout** — `Position 4 · bar 2 of 4`, `Chivo Mono 700 12px / rgba(242,239,230,0.45)`, in the clip header row before "Make a copy".

**Play column** — `padding-top` goes 24px → 46px so the play button still centres against the lanes now that the strip row sits above them.

## Phone geometry (1d)

Both strips are the **non-scrolling** kind. That is the whole trick, and it is the loop map's existing argument: the grid and lanes still swipe sideways, but the playhead lives on a band that never moves, so it can never be lost.

**WHOLE LOOP becomes the clip scrubber** — the existing `LoopMap`, unchanged in geometry (34px band, 92px label, 16 ticks `flex: 1` on a 4px gap), gains:

- `touch-action: none` and pointer handlers on the whole band.
- A 18 × 16px cap at `top: -4px`, `border-radius: 6px`, two 2 × 7px grip bars — cyan playing, `--ink` stopped, `0 2px 6px rgba(0,0,0,0.45)`.
- Snaps to steps: `floor(x / width × 16)`.
- The window bracket underneath is untouched.

**WHOLE SONG** — a new block in `PhoneSongBar`, between the header row and the lanes.

- Caption row: `WHOLE SONG` left, `Position 4 · bar 2 of 4` right, both 10px, 5px below.
- Track: full content width (346px at 390px), 30px tall for the tap target, the bar itself `top: 9px; height: 12px; border-radius: 4px`.
- It spans the song's **real length**: 8 segments (the placed positions), `flex: 1` each, divided by `inset -1px 0 0 rgba(14,31,35,0.9)` rather than a gap, so the marker maths stays exact. Each segment carries its topmost clip's tint at 32%.
- Marker: `width: 3.125%` (one bar of 32), `left: globalBar / 32 × 100%`, cyan + `var(--shadow-loop-map-tick)`, same 1 / 0.45 rule.
- Cap: 22 × 22px at `top: 4px`, `border-radius: 7px`, centred on the current bar.

At 8 positions × 4 bars the bar step is ≈10.8px, which is why the phone strip covers the song's length rather than all 16 slots — spanning 16 would halve that. **Open question:** if songs commonly run to 16 positions, phone bar-snapping gets tight and the phone strip should probably snap to positions instead.

## Tokens used

All from `apps/boop/src/styles/tokens.scss` — no new ones.

`--cyan #6fe0f0` · `--ink #f2efe6` · `--ink-dark #14262a` · `--well #0e1f23` · `--stage #14262a` · `--shadow-loop-map-tick` · `--font-display` (Chivo) · `--font-mono` (Chivo Mono)

Clip tints from `clipTints.ts`: `#6fe0f0 #6fe0a8 #b78bff #ffb03a #ff7fb0`. The strip uses each at 32% alpha.

## Accessibility

- The song strip is a `role="slider"` with `aria-valuemin/max/now` in bars and `aria-valuetext` of `Position 4, bar 2`; the clip rail the same in steps.
- Left/Right arrows move one bar (one step on the clip rail), Home returns to the start of the song.
- Both caps clear 44px of touch target via their row height even though the visible cap is smaller.
- Motion is hard-cut, so `prefers-reduced-motion` needs nothing.

## Not designed here

Loop regions (play positions 3–7 only), skip-back / skip-forward buttons, and a numeric position field. All were considered and left out.
