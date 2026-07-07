# Handoff: "Sweep it off" — empty-the-fridge interaction (option 1e)

## Overview
A replacement for the fridge board's plain **Clear** action. Instead of magnets
vanishing instantly, one press sweeps every magnet across the door
left‑to‑right and they **tumble off the bottom edge** — like brushing crumbs off
a counter. It's a small piece of delight on a destructive action; the end result
is identical to today's `clear()` (an empty board), just animated.

This is option **1e** from the exploration. The other four ideas (stylised
button, pull‑the‑handle, shake‑it‑off, defrost sweep) live in the same prototype
file for reference but are out of scope for this handoff.

## About the Design Files
The file in this bundle (`Empty the Fridge - Options.dc.html`) is a **design
reference built in HTML/JS** — a working prototype that demonstrates the intended
look, feel, and timing. It is **not** production code to ship as‑is.

Your task is to **recreate this interaction inside the existing `apps/fridge`
codebase** using its established patterns: React SPA, SCSS modules, the
`useFridgeBoard` hook for board state, `MagnetView` for magnet rendering, and the
`TopBar` toolbar. Treat the prototype's structure as a guide, not a contract —
reuse the app's real magnet elements and state rather than porting the demo's
simplified ones.

## Fidelity
**High‑fidelity (hifi).** The motion (direction, stagger, distance, spin,
duration, easing) is final and intended to be matched closely. Exact values are
in the sections below.

---

## Where it plugs in (current code map)
- `apps/fridge/src/features/toolbar/TopBar.tsx` — renders the **Clear** button
  (`onClick={onClear}`). This is the trigger. Either restyle/rename this button
  or keep the label and just change what `onClear` *does*.
- `apps/fridge/src/features/board/useFridgeBoard.ts` — owns board state
  (`magnets`, `surfW`, `surfH`, `dragId`, `selId`, …) and exposes `clear()`,
  which today does `setState({ magnets: [], selId: null })` then persists. The
  sweep is a new phase in front of that existing `clear()`.
- `apps/fridge/src/features/board/MagnetView.tsx` +
  `MagnetView.module.scss` — the per‑magnet element (absolutely positioned inside
  the surface). It gains one new visual state: **departing**.
- `apps/fridge/src/pages/FridgePage.tsx` — wires the hook to the components; the
  surface is the `inset:7px`, `overflow:hidden` element inside `FridgeDoor`. The
  `overflow:hidden` is what makes magnets disappear as they cross the bottom edge
  — **keep it**, that's the "fall off" clip.

---

## Interaction & Behavior

### Trigger
- **Enabled only when the board has ≥ 1 magnet** (mirror the Share button's
  `disabled={magnets.length === 0}` guard; a no‑op sweep on an empty board looks
  broken).
- On click → enter a `sweeping` phase. **Do not remove the magnets yet.** The
  magnets stay in state and animate out; state is emptied only after the motion
  finishes.

### The motion (per magnet)
Each magnet animates from its current spot to a departure transform. It is a
**staggered left‑to‑right sweep**: magnets nearer the left edge leave first, so
the wave reads as a single swipe across the door.

Per magnet `m` (with surface‑local `m.x`, its own base tilt `m.rot`, and the
measured surface size `surfW`/`surfH`):

| Property | Value |
|---|---|
| `transition` | `transform 700ms cubic-bezier(.45,.05,.6,1), opacity 700ms ease` |
| `transition-delay` | `Math.round((m.x / surfW) * 260)` ms — left‑to‑right stagger |
| `transform` (departing) | `translate({driftX}px, {surfH + 120}px) rotate({m.rot + 55}deg)` |
| `opacity` (departing) | `0` |

Where:
- **`driftX`** is a small rightward nudge so the sweep has lateral motion, not a
  straight drop. In the prototype (small 288px door) this was `34 + m.rot` px.
  On the real door, scale it to taste — roughly **10–14% of `surfW`**, e.g.
  `driftX = surfW * 0.11 + m.rot`. It does not need to be exact; it just needs to
  feel like a push, not a fall.
- **`surfH + 120`** puts every magnet comfortably below the surface's bottom
  edge. Because the surface is `overflow:hidden`, they clip away as they pass the
  edge — that's the "off the bottom" effect. Add the +120 buffer so even the
  tallest magnet fully clears.
- **`rotate(m.rot + 55deg)`** adds a tumble on the way down. Keep it modest;
  it should look like the magnet toppling, not spinning wildly.

The dragged/selected chrome (selection overlay, rotate knob) should be dismissed
when the sweep starts (`selId = null`).

### Completion
- The animation's total duration ≈ **max stagger delay + 700ms**. With the
  values above the last magnet (`m.x ≈ surfW`) starts at ~260ms and ends at
  ~960ms.
- Prefer driving completion off the **last magnet's `transitionend`** (property
  `transform`); fall back to a `setTimeout(..., 1000)` guard in case a
  `transitionend` is missed (e.g. a magnet already at `opacity:0`).
- On completion, call the **existing `clear()`** to empty `magnets` and persist,
  then drop the `sweeping` phase. Net state is the current empty board — no other
  behavior changes.
- Guard against double‑trigger: ignore the trigger while `sweeping` is true.

### Reduced motion
Respect `@media (prefers-reduced-motion: reduce)` — skip the animation and call
`clear()` immediately (today's instant behavior).

---

## State Management
Add one flag to the board state in `useFridgeBoard.ts`:

- **`sweeping: boolean`** — `false` normally; `true` from trigger until the
  motion completes.

New/changed transitions:
- `startSweep()` — if `magnets.length === 0` or `sweeping`, no‑op. Else set
  `{ sweeping: true, selId: null }`. Schedule completion (transitionend or
  ~1000ms fallback) → `clear()` then `setState({ sweeping: false })`.
- `clear()` — **unchanged** (`{ magnets: [], selId: null }` + persist). The sweep
  wraps it; it stays usable on its own (e.g. New board).

`MagnetView` reads whether it is departing. Cleanest is to pass the flag +
surface dims down (the hook already measures `surfW`/`surfH`):
- Props: `departing: boolean`, `surfW: number`, `surfH: number`.
- When `departing`, apply the departure `transform`/`opacity`/`transition`/
  `transition-delay` above **instead of** its normal `left/top` transition.
  Compute `transition-delay` from `magnet.x` so the stagger is intrinsic to each
  magnet (no per‑index bookkeeping needed).

Persistence: nothing new. The sweep touches only in‑memory magnets; `clear()`
already writes the empty board to `localStorage["fridge:v1"]`.

---

## Design Tokens (from `apps/fridge/src/styles/tokens.scss`)
The interaction adds **no new colors** — it reuses the board's existing look.
Relevant values if you restyle the trigger button as a "stylised" danger action
rather than the ghost Clear:

| Token | Value | Use |
|---|---|---|
| `--danger` | `#e8503a` | filled destructive button base |
| `--danger-text` | `#8a4a42` | current ghost "Clear" label color |
| `--ink` | `#25303f` | filled primary buttons |
| `--r-control` | `9px` | button radius (prototype used 11px on the demo pill) |
| `--shadow-primary` | `0 2px 6px rgba(0,0,0,.22)` | filled button shadow |

Motion tokens (new, local to this feature — not in `tokens.scss` yet):
- **Departure easing:** `cubic-bezier(.45, .05, .6, 1)` (ease‑in‑ish; accelerates
  as it falls).
- **Departure duration:** `700ms`.
- **Stagger span:** `260ms` across the full door width.
- **Fall distance:** `surfaceHeight + 120px`.
- **Tumble:** `+55deg` on top of the magnet's own tilt.

The current TopBar **Clear** button (for reference): ghost style — bg
`rgba(255,255,255,.72)`, `1px solid rgba(0,0,0,.12)`, padding `9px 13px`,
`--r-control`, label color `--danger-text`.

## Assets
**None.** No images, icons, or fonts beyond what the fridge app already ships
(Fredoka for magnets/wordmark; system‑ui for UI chrome). The animation is pure
CSS transforms on existing DOM.

## Files
- `Empty the Fridge - Options.dc.html` (in this bundle) — the interactive
  prototype. Option **1e "Sweep it off"** is the relevant card; open it in a
  browser and press the button to see the exact motion. The departure math lives
  in the `magStyle()` method under the `card === 'bin'` branch (the internal id
  is still `bin` from when it emptied into a bin — the bin was removed, the branch
  name is just legacy).
- Target files to edit, as mapped above: `features/toolbar/TopBar.tsx`,
  `features/board/useFridgeBoard.ts`, `features/board/MagnetView.tsx` (+
  `.module.scss`), `pages/FridgePage.tsx`.
