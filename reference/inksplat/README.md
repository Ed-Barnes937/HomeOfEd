# Handoff: Inksplat Doodling — "Sketchbook" direction (1b)

## Overview
Inksplat ("flash of inspiration") is a calming doodling activity: the app draws random
black ink **blots**, and the user adds a few lines — legs, whiskers, a tail — then places
**eyes** to turn each blot into a little creature. It's built for both kids and adults as a
regulation / relaxation tool, so the interaction is low-pressure and forgiving (unlimited
undo, no scoring, no accounts).

This handoff covers the **Sketchbook · Playful** direction (referenced in design as **1b**):
a warm paper aesthetic where each "new page" **shuffles a fresh field of 6–9 scattered
blots** for the user to fill in like a little zoo.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype
that demonstrates the intended look, feel, and behavior. They are **not** production code to
lift verbatim. The task is to **recreate this design in the target codebase's existing
environment** (React, Vue, SwiftUI, native canvas, etc.), using its established patterns,
component library, and conventions. If no environment exists yet, pick the most appropriate
framework for the project and implement there.

The core drawing surface is an HTML5 `<canvas>`. That part translates directly to any
platform with a 2D canvas / drawing API — the logic (blot generation, freehand stroke,
eye stamp, undo via raster snapshots) is the real spec and is described in full below.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, shadows, and interaction
timing are final. Recreate the UI to match. The one thing intentionally *not* pixel-locked
is blot geometry — blots are procedurally generated and random by design.

## Screens / Views

There is a single screen. Layout is a full-height vertical stack: **header → canvas → toolbar**.

### Screen: Doodle Canvas
- **Purpose**: The user draws on procedurally-generated ink blots and stamps eyes to make creatures.
- **Layout** (top to bottom, `display:flex; flex-direction:column; height:100%`):
  1. **Header** — `flex:none; padding:20px 26px 12px`. A row (`display:flex; align-items:baseline; justify-content:space-between; gap:16px`) with a title block on the left and a mode hint on the right.
  2. **Canvas area** — `flex:1; min-height:0; padding:6px 26px 8px`. Contains one card that fills the space; the `<canvas>` fills the card (`width:100%; height:100%`).
  3. **Toolbar (footer)** — `flex:none; padding:14px 26px 22px; display:flex; align-items:center; gap:10px; flex-wrap:wrap`.

- **Components**:

  **Title block** (header, left)
  - Line 1: `inksplat` in Caveat 44px / weight 700, color `#3b3327`, line-height 1. Followed by
    a smaller inline label `Inksplat` at 0.5em (~22px), `margin-left:12px`, `opacity:0.75`.
  - Line 2 (subtitle): `margin-top:8px`, Nunito 14px, color `#b0a488`, line-height 1.5, `max-width:52ch`.
    Copy: **"Add a few lines — legs, a tail, whiskers, a smile. Then give it eyes, and the ink comes alive."**

  **Mode hint** (header, right)
  - Nunito 12px, color `#b0a488`, right-aligned, line-height 1.5, two lines.
  - Copy for this direction (shuffle): **"A fresh page of ink each time.\nFill it with a little zoo."**

  **Canvas card** (canvas area)
  - `background:#fffdf4`, `border:2px dashed #d9cba7`, `border-radius:12px`,
    `box-shadow:0 14px 34px rgba(80,60,20,0.12), 0 3px 0 #eaddbe`, `overflow:hidden`.
  - `<canvas>` inside: `display:block; width:100%; height:100%; touch-action:none`.
    Cursor is `crosshair` when the Pen tool is active, `pointer` when the Eyes tool is active.
  - The canvas is filled with the card color (`#fffdf4`) as its own background so downloaded
    PNGs include the paper.

  **Tool group** (footer, left) — a pill container: `display:flex; gap:6px; padding:5px;
  background:#fffaef; border:2px solid #eaddbe; border-radius:14px; box-shadow:0 3px 0 #eaddbe`.
  Two toggle buttons:
  - **Pen** — label "✎  Pen". **Eyes** — label "◉  Eyes".
  - Inactive button: transparent background, Nunito 14px / weight 700, color `#b0a488`,
    `padding:9px 16px`, `border-radius:12px`, no border. Hover: background `rgba(0,0,0,0.05)`, text `#3b3327`.
  - Active button: background `#e07a45` (accent), text `#fff`, `box-shadow:0 2px 8px rgba(0,0,0,0.12)`.

  **Nib cluster** (footer) — container: `display:flex; align-items:center; gap:6px;
  padding:5px 10px; background:#fffaef; border:2px solid #eaddbe; border-radius:14px;
  box-shadow:0 3px 0 #eaddbe`.
  - Label "NIB": 10px / weight 800, color `#b0a488`, `letter-spacing:0.1em`, uppercase, `margin-right:2px`.
  - Four size buttons, each `width:34px; height:30px`, centered flex, `border-radius:8px`, no border.
    Selected button: background `#e07a45`; unselected: transparent.
    Each holds a dot (`border-radius:50%`) whose diameter maps to stroke width:
    - 1.6px stroke → 4px dot
    - 3.2px stroke → 7px dot **(default)**
    - 6px stroke → 11px dot
    - 10px stroke → 15px dot
    Dot color: `#fff` when its button is selected, else `#3b3327`.

  **Ink cluster** (footer) — same container style as the nib cluster.
  - Label "INK": same style as "NIB".
  - Four round swatches, each `width:22px; height:22px; border-radius:50%; cursor:pointer`,
    `outline-offset:2px`, `box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25)`.
    Selected swatch has `outline:2px solid #e07a45`; unselected `outline:2px solid transparent`.
    Swatch colors: `#171717` (ink, default), `#1a1f2b` (sumi), `#3a2716` (sepia), `#7a7266` (soft gray).
    Note: ink color affects **pen strokes only** — generated blots are always the base ink (`#171717`),
    and eyes are always white + `#141414`.

  **Spacer** — `flex:1` pushes the remaining buttons to the right.

  **Action buttons** (footer, right) — three buttons:
  - **Undo** and **Shuffle page** ("ghost" style): `border:2px solid #eaddbe; background:#fffaef;
    color:#3b3327`, Nunito 14px / weight 700, `padding:10px 18px; border-radius:10px;
    box-shadow:0 3px 0 #eaddbe`. Hover: `transform:translateY(-1px)`.
  - **Save PNG** (primary): `background:#e07a45; color:#fff`, Nunito 14px / weight 800,
    `padding:11px 20px; border-radius:10px; border:none; box-shadow:0 4px 14px rgba(0,0,0,0.16)`.
    Hover: `transform:translateY(-1px); box-shadow:0 6px 18px rgba(0,0,0,0.22)`.

## Interactions & Behavior

### Blot generation (this direction = "shuffle")
On load and on every **Shuffle page** click:
1. Repaint the whole canvas with the paper color (`#fffdf4`), clearing all art.
2. Generate **N = 6–9** blots (`6 + floor(random*4)`) at randomly scattered positions.
3. Rejection-sample positions so blots don't overlap: for each candidate center `(x,y)` with
   radius `r`, keep it only if `hypot(dx,dy) > (existing.r + r) * 1.15` for every placed blot.
   Try up to 400 times, stop when N are placed. Margin from edges = `0.14 * min(W,H)`.
4. Each blot radius `r = min(W,H) * (0.07 .. 0.13)` (i.e. `0.07 + random*0.06`).

**Blot shape** (procedural, per blot at center `cx,cy`, radius `r`):
- Pick `n = 9..13` points (`9 + floor(random*5)`) evenly spaced in angle around the center.
- Each point's distance from center is `r * (0.62 .. 1.24)` (`r * (0.62 + random*0.62)`) — this
  jitter is what makes the organic "ink blob" outline.
- Build a closed smooth path through the points using the **midpoint-quadratic** technique:
  start at the midpoint between the last and first point, then for each point `p[i]` draw a
  `quadraticCurveTo(controlPoint = p[i], endPoint = midpoint(p[i], p[i+1]))`. Close the path.
- Fill with the ink color (`#171717`).
- Add **0–2 satellite droplets** (`floor(random*3)`): small filled circles at angle `random*2π`,
  distance `r * (1.05 .. 1.55)` from center, radius `r * (0.05 .. 0.17)`.

Other directions (for context; not this one): "single" clears and draws one big centered blot
(`r ≈ 0.28*min`); "infinite" appends 3–5 small blots without clearing.

### Freehand pen
- Pointer-based (mouse + touch + stylus via Pointer Events; `touch-action:none` on the canvas).
- On `pointerdown` (pen tool active): snapshot current canvas for undo, capture the pointer,
  set `drawing=true`, store the point.
- On `pointermove` while drawing: draw a line segment from the last point to the current point.
  Stroke style = current ink color, `lineWidth` = current nib size, `lineCap:round`, `lineJoin:round`.
  Update the last point. (Segment-by-segment; round caps make it read as a continuous smooth line.)
- On `pointerup` / `pointerleave`: `drawing=false`.

### Eye stamp
- On `pointerdown` (eyes tool active): snapshot for undo, then stamp **one eye** at the point
  (no drag; each click = one eye, so users can place any number and asymmetric eyes).
- Eye render at `(x,y)` with size `s = eyeBase * (0.85 .. 1.25)` where `eyeBase` defaults to 12px:
  1. White filled circle, radius `s`, stroked with `#141414` at `lineWidth = max(1, s*0.14)`.
  2. Black pupil (`#141414`), radius `s*0.55`, offset from center by `s*0.3` at a random angle
     (gives each eye a lively, random gaze direction).
  3. White highlight dot, radius `s*0.17`, offset `(-s*0.2, -s*0.2)` from the pupil center.

### Undo
- A stack of raster snapshots (`canvas.toDataURL('image/png')`), capacity **24** (oldest dropped).
- A snapshot is pushed **before** each mutating action: each pen stroke (on pointerdown), each
  eye stamp, and each shuffle.
- **Undo** pops the last snapshot and redraws it (clear canvas, `drawImage` the restored bitmap).

### Save PNG
- Creates an `<a download="inksplat.png" href={canvas.toDataURL('image/png')}>` and clicks it.
  Because the paper color is painted onto the canvas, the export is a complete image on paper.

### Responsive / sizing
- On mount, size the canvas backing store to its displayed CSS size × devicePixelRatio
  (capped at 2), and `setTransform(dpr,0,0,dpr,0,0)` so all drawing math is in CSS pixels.
- If the element measures < 4px (layout not ready), retry on the next animation frame.
- Blot sizes derive from `min(canvasWidth, canvasHeight)`, so the composition scales with the card.

## State Management
- `tool`: `'pen' | 'eyes'` (default `'pen'`).
- `nib`: current stroke width in px — one of `1.6 | 3.2 | 6 | 10` (default `3.2`).
- `penColor`: selected pen ink hex, or null → falls back to the base ink color (default `#171717`).
- Undo history: array of PNG data-URL strings (max 24), held outside render state.
- Transient (not React state): `drawing` flag, `lastPoint`, and the 2D context / measured size.

Data fetching: **none.** Everything is local and ephemeral (no persistence, no accounts — by design).

## Design Tokens (Sketchbook direction)

**Colors**
- Paper (page bg): `#f7efdc`
- Card / canvas bg: `#fffdf4`
- Text (primary): `#3b3327`
- Muted text: `#b0a488`
- Accent (active / primary): `#e07a45`
- Chrome (control bg): `#fffaef`
- Chrome border: `#eaddbe` (used as `2px solid` and as the `0 3px 0` bottom "lip" shadow)
- Card dashed border: `#d9cba7`
- Base ink (blots + default pen): `#171717`
- Alt pen inks: `#1a1f2b` (sumi), `#3a2716` (sepia), `#7a7266` (gray)
- Eye stroke / pupil: `#141414`; eye white / highlight: `#ffffff`

**Typography**
- Display / title: **Caveat** (cursive), weights 500/600/700. Title = 700, 44px.
- UI / body: **Nunito** (sans), weights 400/600/700/800. Body 14px, labels 10–12px, buttons 14px/700–800.

**Spacing**
- Header padding `20px 26px 12px`; canvas area padding `6px 26px 8px`; footer padding `14px 26px 22px`.
- Footer gap `10px`; control-cluster gap `6px`; tool-group gap `6px`.

**Radii**
- Card `12px`; control clusters / tool group (`groupRadius`) `14px`; buttons inside groups `8px`;
  ghost/primary buttons `10px`; nib dots & ink swatches `50%`.

**Shadows**
- Card: `0 14px 34px rgba(80,60,20,0.12), 0 3px 0 #eaddbe`
- Control clusters: `0 3px 0 #eaddbe`
- Active tool button: `0 2px 8px rgba(0,0,0,0.12)`
- Primary button: `0 4px 14px rgba(0,0,0,0.16)`; hover `0 6px 18px rgba(0,0,0,0.22)`

**Motion**
- Button state transitions: `all .15s ease`. Ghost/primary hover lift: `translateY(-1px)`.

## Assets
- **No image or icon assets.** Tool glyphs are Unicode characters: pen `✎` (U+270E), eyes `◉` (U+25C9).
  Replace with your icon set if preferred. Fonts are Google Fonts: **Caveat** and **Nunito**.
  All artwork (blots, eyes) is drawn at runtime on canvas.

## Files
- `Inksplat.dc.html` — the working prototype (the reusable engine; theme/behavior are props).
  This direction = props `theme:"sketchbook"`, `regenMode:"shuffle"`, `inkTone:"ink"`.
- `Inksplat - Directions.dc.html` — the comparison page showing 1b alongside the other directions
  (included for context; not needed to implement 1b).

> Note: `.dc.html` is a self-contained HTML prototype format. Open it in a browser to interact
> with the real thing. The theme values above are the `sketchbook` entry in the `themes()` method,
> and the drawing behavior is in the pen/eye/blot/undo methods of the logic class.
