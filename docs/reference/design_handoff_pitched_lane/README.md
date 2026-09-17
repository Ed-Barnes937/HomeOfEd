# Handoff: Pitched instrument lane (boop)

## Overview

Boop's sequencer currently holds one-note percussion rows: a row is an instrument, a column is a step, a cell is on or off. This design adds a **pitched row** — a "melody lane" — where a column holds eight stacked cells and the cell's *height* is its pitch. Tapping high in the column plays a high note, low plays a low note. The row is otherwise an ordinary boop row: same steps, same bars, same playhead, same add/remove behaviour.

The design goal was to make pitch learnable without notation, note names, or a keyboard, and to keep the row as tappable by a young child as the drum rows above it.

## About the design files

`pitched-lane-reference.html` in this bundle is a **design reference created in HTML** — a static prototype showing intended look and measurements. It is not production code and should not be copied into the app. The task is to **recreate this design in boop's existing codebase**, using its established component patterns, tokens, and audio engine.

The file has no JavaScript. Everything in it is a painted state, not a working sequencer.

## Fidelity

**High-fidelity.** Colours, type, spacing, radii and shadows are final and exact; every value in this README is the value in the reference file. Contrast has been measured and meets WCAG AA throughout (see *Accessibility* below). Recreate the UI to these numbers.

Two things are explicitly **not** final and are drawn as dashed placeholders: the trumpet and bass instrument artwork. See *Assets*.

---

## Screens / Views

There is one view: **the clip editor with a pitched row present.** The reference shows a three-row clip — one drum row, one pitched row, one collapsed pitched row — so the pitched row can be seen in the context that constrains it.

### Layout

Vertical stack inside a well:

```
well: padding 18px, border-radius 24px, background var(--well) #0e1f23
      inset 0 1px 0 rgba(255,255,255,.05)

  bar-number strip   (height auto, margin-bottom 4px)
  rows container     (display:flex; flex-direction:column; gap:10px)
  "+ Add a sound"    (margin-top 10px)
```

Every row is a flex row: `gap: 18px`.

```
[ label column: 160px fixed ] [ step area ]
```

The step area is 16 steps in **4 groups of 4**:

- step width **40px**
- gap between steps within a group **6px**
- gap between groups (bars) **18px**
- group width = 4×40 + 3×6 = **178px**
- step area width = 4×178 + 3×18 = **766px**

The 40px step width applies to **every row in the clip, drum rows included** — if drum rows keep a wider step the columns stop lining up and the playhead column no longer spans them. This is the main change this design forces on existing rows.

Total reference card width: **1022px** (label 160 + gap 18 + steps 766 + well padding 36 + stage padding 40 + border 2).

### Bar-number strip

A 160px spacer, then one label per bar, each `178px` wide, `font: 700 13px 'Chivo Mono'`. Inactive bars `rgba(242,239,230,.55)`; the bar containing the playhead `rgba(242,239,230,.9)`.

### Label column (160px)

Three variants appear in the reference.

**Drum row (Kick).** Flex row, `gap: 12px`, vertically centred.
- Art tile: 52×52, `border-radius: 16px`, background `rgba(255,255,255,.06)`. Inside, a 40×40 CSS-masked glyph filled `var(--instrument-kick)` #ff6b5c.
- Name: `font: 800 17px 'Chivo'`, `letter-spacing: -.015em`, colour `var(--ink)` #f2efe6.

**Pitched row, expanded (Trumpet).** Flex row, `gap: 12px`, `align-items: flex-start`, `padding-top: 6px`.
- Art tile: 52×52 as above (placeholder, see *Assets*).
- Text stack, `gap: 3px`:
  - Name — `font: 800 17px 'Chivo'`, `letter-spacing: -.015em`, `var(--ink)`.
  - `HIGH` — `font: 700 10px/10px 'Chivo'`, `letter-spacing: .06em`, `rgba(242,239,230,.6)`.
  - **Pitch gradient bar** — 4px wide, 110px tall, `border-radius: 2px`, `margin: 2px 0`, `background: linear-gradient(180deg, #ffeed2, #b87a1e)`. This is the only pitch legend; there are no note names.
  - `LOW` — same type as HIGH.
- Collapse control: 44×44, `margin-left: auto`, `border-radius: 12px`, background `rgba(255,255,255,.11)`, chevron `▾` 14px `rgba(242,239,230,.9)`.

**Pitched row, collapsed (Bass).** Same structure, vertically centred, with:
- A four-bar mini pitch contour instead of the gradient: bars 4px wide, `border-radius: 2px`, heights 6/8/10/12px, colours `#ab95d8`, `#c6b5e7`, `#e2d6f7`, `#9d84d0`, `align-items: flex-end`, `gap: 2px`.
- Expand control: 44×44, background `rgba(255,255,255,.08)`, chevron `▸` `rgba(242,239,230,.7)`.

### Drum row cells

40×56, `border-radius: 12px`.
- Off: background alternating `rgba(255,255,255,.055)` / `rgba(255,255,255,.035)`; `box-shadow: inset 0 1px 0 rgba(255,255,255,.08)`.
- On: background `var(--instrument-kick)`; `box-shadow: 0 2px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.38)`; 26×26 masked glyph at `rgba(0,0,0,.62)`.

### Pitched row — the lane

The lane sits on a **plate**, not as loose cells:

```
plate: padding 8px 6px; margin: -8px -6px; border-radius: 16px;
       background: rgba(255,255,255,.03);
       box-shadow: inset 0 0 0 1px rgba(255,255,255,.07);
```

The negative margin cancels the padding so the lane's step columns sit **flush** with the drum columns above. Without it the lane is offset 6px right and the grid reads as broken.

Each step is a column: `display:flex; flex-direction:column; justify-content:center; gap:4px; width:40px`, holding **8 cells**.

- Cell: height **20px**, `border-radius: 6px`.
- Lane height: 8×20 + 7×4 = **188px**.
- Off cells: alternating `rgba(255,255,255,.055)` / `rgba(255,255,255,.035)` by index.
- On cells: the **hue ladder** below, plus `box-shadow: 0 2px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.38)`.

**Hue ladder** (index 0 = top cell = highest pitch):

| # | Hex | # | Hex |
|---|-----|---|-----|
| 0 | `#fff5e4` | 4 | `#ebcd9f` |
| 1 | `#ffeed2` | 5 | `#e1bc85` |
| 2 | `#f9e3c3` | 6 | `#d6ac6b` |
| 3 | `#f5ddb8` | 7 | `#cc9b51` |

The ladder is a *secondary* cue only. Pitch is communicated by vertical position; the ladder must never be the sole means of distinguishing two notes.

### Playhead

A column highlight spanning all rows, behind the cells:

```
position: absolute; top: -8px; bottom: -8px;
width: 56px (step 40 + 8px bleed each side);
border-radius: 17px;
background: linear-gradient(180deg, rgba(111,224,240,.24), rgba(111,224,240,.07));
box-shadow: var(--shadow-playhead-column)  /* 0 0 0 1px rgba(111,224,240,.34) */
```

Left offset = step's left edge − 8px. It sits at `z-index: 0` with rows at `z-index: 1`, so it reads as a lit column rather than a scrim over the cells.

A painted cell inside the playhead column gets the **ring**:

```
box-shadow: inset 0 0 0 2px #14262a,
            0 0 0 2px #f2efe6,
            0 6px 14px rgba(0,0,0,.45);
```

Dark inside, light outside — legible against both the pale ladder colours and the dark lane. **This same ring is the keyboard focus ring.**

### "+ Add a sound"

Height 44px, `padding: 0 18px`, `border: 2px dashed rgba(242,239,230,.3)`, `border-radius: 16px`, background `rgba(255,255,255,.03)`, `font: 800 15px 'Chivo'`, `letter-spacing: -.015em`, colour `rgba(242,239,230,.75)`.

---

## Interactions & Behavior

**The pitch range is a full octave — eight cells, do re mi fa so la ti do.** Eight rather than seven is deliberate: the top and bottom cells are the same note an octave apart, so a run up the lane resolves. This lets a child play tunes they already know, which needs `fa` and `ti`. A pentatonic (six-cell) alternative was explored and rejected.

**Which octave each instrument sits in is per-instrument and still open.** A trumpet, a bass and a marimba all get the same eight cells pitched into their own comfortable register. This belongs in the kit manifest, not the grid.

**Tap** a cell to paint a note at that pitch. This is the primary gesture.

**A column can hold more than one note.** This is existing boop behaviour carried over — tapping a second cell in a column adds it, it does not replace the first. A column of stacked notes is a chord.

**Click-and-drag fills every cell it crosses.** No replace semantics, no line-drawing: a drag down the lane paints a vertical cluster.

**Hit bands.** A 20px tile is below the 44px tap floor, so the *column* carries the hit, not the tile. The column is divided into 8 hit bands:
- interior bands **24px**, centred on their tile (2px of bleed into each gap);
- the top and bottom bands run **22px** of tile-and-gap plus the plate's 8px padding, so a tap slightly above the top cell or below the bottom cell still lands.

Bands must be centred on their tiles. An earlier build had them offset by the plate padding and taps consistently landed one note low.

**Collapse.** A pitched row collapses to a 56px-tall summary showing note positions as small pebbles (16px tall, `border-radius: 8px`, inset 4px from the column edges, positioned by pitch). This exists because several pitched rows at 188px each make the clip unscannable. Collapsed rows still receive the playhead column.

**Playback** is unchanged from boop: the playhead advances a step at a time and every painted cell in the column sounds.

## State Management

Per pitched row:
- `notes: Set<pitchIndex>[]` — one set per step, `pitchIndex` 0–7 from the bottom. **Note the plural**: the existing save format assumes at most one value per step for percussion. Confirm whether a set-per-step fits the current clip schema or forces a **save-format version bump**; also confirm the share-link encoding has room.
- `collapsed: boolean` — per row, UI-only, need not persist.
- `octave` / `register` — per instrument, sourced from the kit manifest, not user-set in this design.

Kit manifest needs a new field flagging a sound as **pitched vs one-note**, so the grid knows which row type to render.

## Accessibility

- All text and glyph contrast meets **WCAG AA** (4.5:1 body, 3:1 headline-scale). Eight failures were found and fixed during design; do not darken the pale ladder colours or lighten the row labels.
- Pitch must be conveyed by **position and grouping**, never colour alone.
- Hit targets: every control is ≥44px. Lane cells are the exception and are handled by the column-wide hit bands described above.
- **Focus order and text alternatives for lanes are still open.** This is the first place in boop where a note may need a *name* — a screen reader cannot announce "the fifth cell". Solfège, letter names, or ordinals are all undecided.

## Design Tokens

Taken from boop's existing token set; nothing new was introduced except the hue ladder.

```
--stage            #14262a
--well             #0e1f23
--ink              #f2efe6
--paper            #f5f1e8
--ink-dark         #14262a
--cyan             #6fe0f0
--cyan-solid       #0b7c91
--play             #ffd24a
--danger           #ff8a7a
--instrument-kick  #ff6b5c
--instrument-snare #ffb03a
--instrument-hihat #dce85c
--instrument-tom   #ff7fb0
--instrument-marimba #6fe0a8
--instrument-boop  #b78bff
--shadow-playhead-column  0 0 0 1px rgba(111,224,240,.34)
```

Bass pebble purples (not tokens, derived from `--instrument-boop`): `#9d84d0`, `#ab95d8`, `#c6b5e7`, `#e2d6f7`.

**Spacing:** 2, 4, 6, 8, 10, 12, 14, 18, 20 px.
**Radii:** 6 (lane cell), 8 (pebble), 12 (drum cell, 44px control), 16 (plate, art tile, add-button), 17 (playhead column), 22, 24 (well).
**Type:** `'Chivo'` 800 17px / −.015em (instrument name); 800 15px / −.015em (button); 700 10px / .06em (HIGH·LOW). `'Chivo Mono'` 700 13px (bar numbers), 400 11px (captions).

## Assets

- **Fonts** — `fonts/chivo-latin.woff2`, `fonts/chivo-mono-latin.woff2`, included in this bundle. These are boop's existing faces; use the codebase's copies rather than these.
- **Drum glyph** — the kick artwork is an inline SVG data-URI applied as a CSS mask, taken from boop's existing kit. Masking (rather than `<img>`) is what lets the glyph take `rgba(0,0,0,.62)` on a painted cell and the instrument hue on the label tile.
- **Trumpet and bass artwork — does not exist.** Both are drawn as 40×40 dashed placeholders. These need commissioning as a content ticket in the kit's existing flat 512px style. Do not ship the placeholders.

## Files

- `pitched-lane-reference.html` — the design reference (open in a browser; static, no JS).
- `fonts/` — the two web fonts it uses.

The full design exploration, including rejected options and the measurement ledgers behind the contrast and geometry decisions, lives in `Pitched instruments.dc.html` in the originating project. Turn 6 in that file is the design documented here; turn 7 is an unresolved side exploration of chord affordances and is **not** part of this handoff.
