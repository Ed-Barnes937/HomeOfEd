# @hoe/magnet-kit

Pure-TS geometry and gesture maths for fridge-magnet-style apps: AABB collision
("bump/shove"), spawn placement, and rotation snapping. **Zero runtime
dependencies. No React, no DOM.** The reusable engine behind `apps/fridge`; the
seam for a future ransom-notes app is `Box` + these functions (ADR 0009).

Functions **mutate the boxes passed in** (documented per function) — that is
what makes the multi-pass relax cheap. Callers that need immutability clone
first (the app does, per React state rules).

## Usage

```ts
import { relax, spawnPlacement, clampOne, knobRotation, snapRotation, wheelRotation } from '@hoe/magnet-kit'
import type { Box } from '@hoe/magnet-kit'

// Add a magnet, then settle the scene so nothing overlaps.
const p = spawnPlacement(W, H, { w: 52, h: 60 }, Math.random)
const boxes: Box[] = [...existing, { id: nextId, x: p.x, y: p.y, w: 52, h: 60 }]
relax(boxes, nextId, W, H) // the new magnet is `active` → it shoves neighbours
```

## API

| Function | What it does |
| --- | --- |
| `clampOne(b, W, H)` | Clamp one box into bounds in place: `x → [0, W-w]`, `y → [0, H-h]`. |
| `relax(boxes, activeId, W, H, passes=7)` | Separate every overlapping pair for `passes` iterations, clamping after each pass. Mutates in place. |
| `spawnPlacement(W, H, size, rng)` | Where a new magnet appears (top-centre, jittered, ±7° tilt). Returns **unclamped** coords — run `relax` right after. |
| `knobRotation(cx, cy, px, py)` | Angle (deg) from a magnet's centre to the pointer; knob straight up = 0°. |
| `snapRotation(rot, within=7)` | Normalise to `[0,360)`, then snap to the nearest 90° when the delta is strictly `< within`. |
| `wheelRotation(rot, deltaY, step=7)` | `rot + step * Math.sign(deltaY)`. |

## `relax` semantics

Per pass, for every pair with a positive AABB overlap on both axes, separate
along the **smaller-overlap axis**, direction set by centre comparison. Push
rules:

- The pair member whose `id === activeId` is **immovable** — the partner takes
  the full push. This is what makes a dragged magnet shove its neighbours.
- Otherwise the push splits **50/50**, so shoves chain through a cluster.

`clampOne` runs on every box after each pass, so **every box is in bounds after
`relax`**. Convergence to zero overlap is *not* guaranteed for dense scenes
jammed against the bounds — the per-pass clamp re-introduces overlap there. This
matches the reference prototype and is intended; total overlap is
non-increasing, never worse than the input.

## Deliberate divergences from the reference prototype

- `snapRotation` always normalises to `[0,360)` first, snap or not.
- `wheelRotation` is a **no-op at `deltaY === 0`** (`Math.sign(0) === 0`), where
  the prototype rotated −7°.

## Testing

One `*.test.ts` per module; `vitest run`. Random-scene tests use a seeded
`mulberry32` PRNG — never `Math.random` — so they are deterministic.
