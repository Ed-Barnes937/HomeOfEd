# 02 — Element modularity model

Type: prototype
Status: resolved
Blocked by: 01

## Question

What is the interface for defining an element (and its interactions) so that
adding steam/fire/acid later is cheap and doesn't touch the engine core?
Candidate shapes: data-driven registry (element = config object + reaction
table) vs behaviour-function registry (element = data + `update(cell, api)`
composed from shared movement primitives). Resolve with the
`design-an-interface` / `prototype` skills against concrete cases: the v1 five
(dirt, sand, water, lava, stone) plus hypothetical fire, steam, and acid to
pressure-test extensibility. Must honour the locked architecture stance
(typed-array grid, determinism, chunk-friendly updates) and support spawners.

## Answer

Ran the `design-an-interface` pattern: four parallel agents, each forced into a
radically different shape — pure data-driven config, behaviour-function registry,
archetype + hooks, and a Sandspiel-Studio-style rule-list DSL. Full deliverables:
[element-model-designs.md](../research/element-model-designs.md).

**Decision: Design 3 — archetype + hooks — with three grafts.**

The boundary: **archetypes own movement; hooks own transmutation.**

- `Archetype` is a closed, engine-owned set of four motion kernels:
  `static` | `powder {density, slide}` | `liquid {density, dispersion, move?}` |
  `gas {density, dispersion, move?}`. `move` is per-step move probability
  (lava = liquid with `move: 0.15`); density orders displacement; gas density < 0.
- `ElementDef` = pinned `id`, `name`, `colours`, `tags`, `archetype`, optional
  `hardness`, optional engine-managed `lifetime {ticks, jitter, becomes}`
  (stored in `ra`), and at most one hook: `onTick(api)`, which runs strictly
  AFTER archetype movement so it can never corrupt the movement invariant.
- Reactions stay in the tag-keyed pair table (`{a, b, p, aBecomes, bBecomes,
  maxHardness}`) — all four designs independently converged on this shape.
  Water+lava→stone and acid-corrodes-corrodible are table rows, not hooks.
- The `Api` is chunk-relative only (`get/set/swap/become`, `has(tag)`,
  `ra`/`rb` scratch, `rand()/randInt()` from the sim PRNG). Determinism is
  structural: the only randomness reachable is `api.rand()`.
- Pressure tests pass with no new archetype: fire = gas + lifetime + one small
  ignition `onTick`; steam = gas + lifetime→water; acid = liquid + hardness +
  a reaction row. v1's five elements are pure config, zero behavioural code.

**Grafts (from the other designs):**

1. **WALL sentinel** (from behaviour-functions design): out-of-bounds reads
   return a WALL cell, never undefined — no element ever branches on edges.
2. **Boot-time registry validation** (from rule-DSL design): duplicate ids,
   unknown reaction targets, bad probabilities fail at load.
3. **`ra`/`rb` byte-budget ownership written into the spec**: `lifetime` owns
   `ra`, colour variant owns `rb`; a hook wanting scratch must not collide with
   an engine feature that owns the byte.

**Accepted, named failure mode:** motion that isn't gravity-relative
(projectiles with a velocity heading) would someday force a fifth `particle`
archetype — a bounded, one-time cost, explicitly preferred over opening the
archetype set now. Field-coupled physics (heat, pressure) is a separate engine
subsystem under any design and out of v1 scope.
