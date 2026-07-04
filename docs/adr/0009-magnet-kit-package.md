# 0009 — Extract `@hoe/magnet-kit` as a package before the fridge app exists

- **Status:** Accepted
- **Date:** 2026-07-03
- **Related:** [0003-fridge-implementation-plan.md](../plans/0003-fridge-implementation-plan.md)
  §3, [0004](0004-typescript-source-exports.md) (TS source exports),
  root `CLAUDE.md` hard rule 1 (shared code goes in packages)

## Context

`apps/fridge` needs collision/placement/rotation maths: AABB overlap
resolution ("bump" physics), spawn placement, and knob/wheel rotation with
90°-snap. This maths has no UI or persistence concerns of its own — it's pure
geometry over small boxes.

A second, unbuilt consumer is already in view: a future magnet-style app
(e.g. a ransom-notes game) is expected to reuse the same collision/placement
engine on the same `Box` shape. Root `CLAUDE.md` hard rule 1 says apps may not
import from other apps — shared code goes in a package. If the engine lived
inside `apps/fridge`, the ransom-notes app would have nothing to import from
without either duplicating the maths or reaching into another app's
internals.

The usual instinct is "extract on second use" — don't build a package for a
single consumer. That instinct is overridden here: reuse isn't speculative,
it's an explicit product requirement from the fridge spec, decided before any
code exists.

## Decision

Create `packages/magnet-kit` (`@hoe/magnet-kit`) now, as part of the fridge
build, before a second consumer exists — a deliberate exception to
extract-on-second-use, made because the reuse requirement is already known
rather than guessed at.

**API shape.** A small functional API over a minimal `Box { id, x, y, w, h }`:

- Functions **mutate the boxes passed in** (`clampOne`, `relax`, …) rather
  than returning new arrays — this is what keeps the multi-pass relax cheap.
  Callers that need immutability (the app does, per React state rules) clone
  before calling.
- **Zero runtime dependencies.**
- **No React, no DOM types** anywhere in the package — it only ever sees
  plain numbers and the `Box`/`Size`/`Placement` shapes.
- TS source exports (`"exports": { ".": "./src/index.ts" }`), per
  [ADR 0004](0004-typescript-source-exports.md) — same shape as
  `packages/logger`.

**What stays out of the engine.** Magnet types/sizes/colours, serialisation,
React state, and persistence are app concerns, not engine concerns. The reuse
seam for a future consumer is exactly `Box` plus the exported functions
(`clampOne`, `relax`, `spawnPlacement`, `knobRotation`, `snapRotation`,
`wheelRotation`) — nothing else crosses the boundary.

## Consequences

- The engine is TDD-able in complete isolation from any app, DOM, or React
  runtime — its test suite is pure input/output assertions on arrays of
  boxes and numbers.
- Reuse is enforced by a **physical package boundary**, not a folder
  convention inside `apps/fridge` that a future app would have to informally
  agree to respect.
- The cost: `packages/magnet-kit` ships with exactly one consumer
  (`apps/fridge`) until the ransom-notes app (or similar) materialises. That
  cost is accepted because the extraction is cheap now (the maths is small
  and self-contained) and would be more disruptive to retrofit once fridge's
  app code and the engine were already entangled.
