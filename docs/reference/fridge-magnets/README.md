# Handoff: Fridge Magnets Web App

## Overview
A playful single-screen web app that mimics the front of a refrigerator covered in magnets. Users add magnets from a tray (alphabet letters, numbers, poetry/word tiles, and fractional-circle discs), drag them around the door, and — critically — magnets **physically bump and shove each other** while dragging, so the board feels tactile and 3D rather than like a flat HTML canvas. Users can rotate magnets, recolor them, change the fridge finish and the "kitchen light", and **save/name multiple fridges**.

## About the Design Files
The file in this bundle (`Fridge.dc.html`) is a **design reference built in HTML/JS** — a working prototype that demonstrates the intended look, feel, and interaction model. It is **not** production code to ship as-is.

Your task is to **recreate this experience in the target codebase's environment** using its established patterns, component library, and state/animation tooling. If there is no existing environment yet, choose the most appropriate stack (React + a lightweight state store is a natural fit; the collision loop is framework-agnostic vanilla math). The prototype happens to be authored as a self-contained component with an internal React-like render — treat its structure as a guide, not a contract.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, shadows, gloss recipes, and interaction timing are all final and intended to be matched closely. Exact values are in `styles/tokens.css`. Recreate the visuals pixel-close using your codebase's libraries.

---

## Screens / Views
This is a **single full-viewport screen** with four regions. See `screenshots/01-default-view.png`.

### A. Top toolbar (fixed, top, z-index 30)
- **Layout:** full-width flex row, `space-between`, padding `15px 22px`, gap 16.
- **Left group** (baseline-aligned, gap 11):
  - Brand wordmark **"the fridge"** — `--font-display` 700, 23px, `--text-strong`, letter-spacing .3px.
  - Helper text **"drag to bump · click to rotate · double-click to remove"** — 12.5px, `--text-muted`, weight 500.
- **Right group** (flex, gap 8):
  - Text input, placeholder **"name this fridge…"** — 8×12px padding, `--r-control`, 1px border `rgba(0,0,0,.14)`, bg `rgba(255,255,255,.82)`, width 150px.
  - **Save** button — filled `--ink`, white text, 9×15px, `--r-control`, `--shadow-primary`.
  - **New** and **Clear** buttons — ghost: bg `rgba(255,255,255,.72)`, 1px border, 9×13px. "Clear" label uses `--danger-text`.

### B. Saved-fridge chips row (fixed, top:58, z-index 29)
- Horizontal wrapping flex of pills. Empty state = muted caption "No saved fridges yet — arrange some magnets and hit Save."
- **Chip:** flex row, gap 7, padding `5px 10px`, `--r-pill`, 12.5px/600. Active chip = filled `--ink`/white; inactive = `rgba(255,255,255,.72)`/`--text`. Trailing **×** (opacity .55) deletes that saved fridge (stopPropagation so it doesn't also load it).

### C. Fridge (stage, centered, z-index 10)
- **Stage:** absolutely positioned `top:98 … bottom:210`, flex-centers the door, padding `6px 26px`.
- **Door:** `width:min(1060px,92vw)`, `height:100%`, `max-height:648px`, `border-radius:--r-fridge`, `--shadow-fridge`, 1px border `rgba(120,124,128,.5)`, `overflow:hidden`. Base background = `--finish-steel`.
  - **Finish overlay** (`inset:0`, `border-radius:inherit`, pointer-events none, z-index 2): transparent for steel; `--finish-white/red/mint` otherwise. Transitions `opacity/background .3s`.
  - **Magnet surface** (`inset:7px`, `border-radius:--r-surface`, `overflow:hidden`, z-index 5): the draggable area. All magnets are absolutely positioned **within** this element (their x/y are surface-local px). Clicking empty surface deselects. `{selection overlay}` also lives here.
  - **Handle** (z-index 8, pointer-events none): vertical chrome bar, `top:13% right:26px`, `14×74%`, `border-radius:8px`, chrome gradient `linear-gradient(90deg,#9ba0a4,#eaedee 42%,#c2c6c9 60%,#8d9296)`, raised shadow.
- **Kitchen-light overlay** covers the whole page (z-index 1, pointer-events none): transparent (warm) / cool tint / night dim — see `--light-*`. This is what "Night" does in screenshot 05.

### D. Tray / drawer (fixed, bottom, height 210, z-index 20)
- Frosted panel: `--tray-bg`, `backdrop-filter:blur(8px)`, 1px top border, top shadow `0 -6px 22px rgba(0,0,0,.08)`, padding `15px 22px 18px`. Inner content max-width 1060, centered. Two columns, gap 20:
  - **Appearance column** (width 190, right border divider, padding-right 18):
    - **"FRIDGE FINISH"** caption (10px/700, uppercase, letter-spacing .7, `--text-muted`) → row of 4 swatch circles (26px) labeled Steel / White / Red / Mint. Active swatch = 2px `--ink` ring + inset white ring.
    - **"KITCHEN LIGHT"** caption → row of 3 swatch circles: Warm (`radial …#ffe3a6→#f0c26a`), Cool (`…#c3ddf0→#8fb4d6`), Night (`…#4a5262→#2a2f3a`).
  - **Add column** (flex:1):
    - **Top row** (`space-between`): tab bar + color picker.
      - **Tabs:** `A B C` / `1 2 3` / `Words` / `Shapes` — 6×13px, `--r-tab`, active = `--ink`/white + shadow, inactive = translucent + inset hairline; hover lifts 1px.
      - **Color picker** (hidden on Words tab, replaced by italic note "word tiles are always white"): "COLOR" caption + **auto** pill + 6 color swatches (20px). Selected drives the color of newly-added letters/numbers/shapes; `auto` cycles the palette in order.
    - **Palette body** (scrolls): Letters = 26-tile auto-fill grid (min 38px) of `--font-display` glyphs; Numbers = 0–9 grid; Words = text input ("type any word…", Enter or **Add**) + preset word chips (Georgia); Shapes = 5 buttons ¼ ⅓ ½ ¾ ● (50px). All tiles: `linear-gradient(180deg,#fff,#f0efe9)`, 1px border, `--r-control`, `--shadow-btn`, hover lifts 2px to `--shadow-btn-hover`.
    - **Hint line** (11px, `--text-muted`): "Tap to add · drag on the fridge to bump neighbours · click a magnet, then spin the knob or scroll to rotate".

### Magnet selection overlay (screenshot 02)
When a magnet is selected (set on grab / tap / wheel), a non-interactive overlay tracks its box (same left/top/w/h/rotation), z-index 10001:
- **Dashed ring** `inset:-5px`, `1.5px dashed rgba(37,48,63,.75)`, radius 12px (or 50% for fractions).
- **Rotate stalk + knob:** a 2px line rising 19px above center to a 20px white knob (`radial #fff→#e4e6ea`, 1.5px `--ink` border), cursor grab, pointer-events auto. The knob's inner arc hints "rotate".
- **Delete ×:** 20px circle top-right (`right:-11 top:-11`), bg `--danger`, white ×, pointer-events auto.

---

## Interactions & Behavior

### Adding
Tapping any palette tile spawns that magnet near center-top (`x = W/2 ± up to 45px`, `y = 16%H + up to 46px`), with a small random tilt (±7°), then runs the collision relaxation so it settles without overlapping. New magnet becomes the selected one. Letters/numbers/shapes take the picked color (or the next palette color if `auto`); word tiles are always the white paper style. Custom words via the Words input.

### Dragging + collision "bump" (the core feel)
- Pointer events on each magnet; `setPointerCapture` on pointerdown. Position = pointer − grab-offset, clamped to the surface.
- On every move, an **AABB separation relaxation** runs (`relax()`, 7 passes over all pairs): overlapping pairs are pushed apart along their smaller-overlap axis. The **actively dragged** magnet is immovable and shoves others fully; non-active overlapping pairs split the push 50/50, so shoves **chain/domino** through a cluster. Everything re-clamps to bounds each pass.
- Non-dragged magnets animate their `left/top` with `transition: .13s cubic-bezier(.2,.9,.3,1.15)` → they visibly *slide* when bumped. The dragged magnet has no transition (1:1 with pointer) and scales to **1.08** with raised z-index while held.

### Rotating
- **Knob:** drag the selection knob → angle = `atan2(dy, dx)` from the magnet center, `rot = angle + 90` (knob-up = 0°). On release, **snap** to the nearest 0/90/180/270 if within **7°**.
- **Scroll wheel** over a magnet rotates it ±7° per tick (and selects it).

### Removing
- **Double-click** a magnet, or click the selection **×**.
- **Clear** empties the current fridge.

### Saving fridges
- **Save** upserts the current arrangement (magnets + finish + wall) under the typed name (falls back to the active name, else "Fridge N"). Chips appear in region B.
- Clicking a chip **loads** that fridge (restores magnets, finish, light) and re-clamps to the current surface. **×** on a chip deletes it. **New** starts an empty "New Fridge".

### Appearance
- Finish swatches set the door overlay; light swatches set the page-wide tint. Both transition smoothly and persist.

### Persistence
All state (magnets, saved fridges, active name, finish, wall, id counters) is serialized to **`localStorage["fridge:v1"]`** on every mutation and restored on load. First-ever load seeds a demo board: **HELLO** in letters, a "you're the coolest" word tile, two fraction discs, and a green **3**. On load, magnets are re-clamped to the current surface size (handles window resizes gracefully).

---

## State Management
Per-board state:
- `magnets[]` — each: `{ id, type: 'letter'|'number'|'word'|'fraction', label, color:{main,dark,light}|null, deg (fractions), x, y, w, h, rot, z }`
- `dragId` — magnet currently being dragged (null otherwise)
- `selId` — currently selected magnet (drives the rotate/delete overlay)
- `finish` — `'steel'|'white'|'red'|'mint'`
- `wall` — `'warm'|'cool'|'dark'`
- `pick` — selected palette color index, or `null` for auto
- `surfW/surfH` — measured surface size (for clamping/spawning)
- `tab`, `newWord`, `saveName` — tray/toolbar UI state
- `saved[]` — `[{ name, magnets[], finish, wall }]`
- non-render refs: `nid` (id counter), `zTop` (stacking counter), transient `_drag` / `_rot` gesture data

**Tweakable props** (design-time knobs, all optional with sensible defaults): `fridgeFinish` (default `mint`), `wallShade` (default `warm`), `magnetGloss` (default `false` → matte letters; `true` → glossy). `magnetGloss` toggles the letter/number/fraction gloss recipe.

## Design Tokens
See **`styles/tokens.css`** — a complete, commented list of colors, the 6-shade magnet palette, gradients (wall, all finishes, light overlays, tray), radii, shadows, font stacks, and the three magnet visual recipes (glossy/matte letter, word tile, fraction disc).

## Assets
- **No raster/vector art.** Every magnet, the brushed-steel door, the chrome handle, and the gloss highlights are pure CSS (gradients + layered shadows + `background-clip:text`). This is intentional and reproducible from `tokens.css`.
- **Fonts:** see **`fonts/FONTS.md`** (Fredoka via Google Fonts / self-host; Georgia + system-ui are system fonts). Fredoka `.woff2` binaries are not bundled — download link is in that file.
- **Screenshots:** `screenshots/` — default view, magnet selected (rotate + delete), Words tray, Shapes tray, red finish + night light.

## Files
- `Fridge.dc.html` — the full working prototype (reference implementation; open in a browser to interact).
- `styles/tokens.css` — design tokens + component recipes.
- `fonts/FONTS.md` — font stack & loading.
- `screenshots/*.png` — core interface states.
