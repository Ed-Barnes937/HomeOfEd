# 02 — Registry lookups off `Map` and onto flat arrays

**Status:** done
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md)

`ElementRegistry` is the sim's innermost lookup, and every one of its hot
methods is a `Map.get`. Species ids are **bytes** — the whole key space is
0–255 — so a `Map` is buying nothing that a 256-entry array does not.

Count the traffic on one cell, one tick:

- `Sim.#scanChunk` → `registry.get(species)` — **once per scanned cell**.
- `applyReactions` → `registry.reactionFor(self, neighbour)` — **four times
  per scanned cell**, one per orthogonal contact.
- `canDisplace` → `registry.density(mover)` **and** `registry.density(target)`
  — **twice per call**, and `canFlow` alone calls `canMove` three to five
  times before a fluid has taken a single step.
- `Sim.#afterMovement` → `registry.lifetimeOf(def.id)` — once per cell.

A busy world scans 5–8k cells a tick, so this is tens of thousands of `Map.get`
calls per tick, on integer keys, every one of which a typed-array index would
answer in a single load.

**What to change** — all inside `apps/silt/src/sim/registry.ts`, behind the
existing `ElementRegistry` interface. The interface does not change; nothing
that calls it changes.

- `get(id)` → a `(ElementDef | undefined)[]` of length 256, indexed by id.
- `density(id)` → a `Float64Array(256)` of values plus a `Uint8Array(256)`
  presence flag, **or** a `Float64Array` pre-filled with `NaN` and a
  `Number.isNaN` test. Do not conflate "density 0" with "no density" — a static
  element genuinely has no density and `canDisplace` depends on the difference.
- `lifetimeOf(id)` → a `(ResolvedLifetime | undefined)[]` of length 256.
- `reactionFor(a, b)` → the pair key is already `(a << 8) | b`, which is a dense
  index into 65536 slots. Replace the `Map<number, Reaction>` with an
  `Int16Array(65536)` of indices into a `Reaction[]`, filled with `-1`. That is
  128 KB, allocated once at boot — cheap, and it turns the hottest lookup in
  the engine into one typed-array load and one bounds test.
- `has(id, tag)` can stay a `Map` → `Set` of strings. It is called from element
  hooks only and no hook in the current roster uses it.

**Also worth folding in:** `canDisplace` currently reads both densities through
two interface calls. Leave the exported signature alone (`moves.ts` and
`api.ts` both call it and they must never disagree), but the two lookups inside
it are now array loads, which is the whole point.

**Do not** change the boot-time validation. It runs once and it is the thing
that refuses a bad roster; leaving it as readable `Map`-and-`Set` code is
correct.

**Watch out for:**

- **`reactionFor` must keep "the earlier row wins".** `resolvePairs` uses
  `if (!pairs.has(key))` to enforce it. The array form needs the same guard —
  `if (table[key] === -1)` — or a later tag row will start overwriting the
  specific pair that was meant to precede it (acid + wood is the case that
  breaks, and `registry.test.ts` pins it).
- **The RNG stream must not shift.** None of this touches a draw, so the
  determinism test in `sim.test.ts` is the check: it must pass unchanged.
- `Int16Array` holds up to 32767 distinct reactions, which is far past any
  plausible roster, but assert the count at boot rather than silently truncating.

**Expected:** the largest single win available in the engine. Measure with
`pnpm --filter silt run bench` before and after; put both tables in the PR.

- [ ] `ElementRegistry` interface unchanged; no caller edited
- [ ] `get` / `density` / `lifetimeOf` / `reactionFor` are flat-array lookups
- [ ] "earlier row wins" still holds — `registry.test.ts` green without edits
- [ ] Determinism test green without edits
- [ ] Bench before/after in the PR description, with scanned counts
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green

## Answer

Done, interface unchanged, no caller edited. `get`/`density`/`lifetimeOf` are
256-slot arrays; `reactionFor` is an `Int16Array(65536)` of indices into a
`Reaction[]`. "Density 0" stays distinct from "no density" via a presence flag.

−12.4% / −6.8% / −2.4% / flat, scanned counts identical. **Smaller than the
ticket's "largest single win available" claim** — V8 already handles small
integer-keyed `Map`s well, so the array form saves the hash and the megamorphic
call, not the whole lookup.
