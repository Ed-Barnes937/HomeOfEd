# 03 — Stop allocating in the per-cell neighbour loops

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md)

Three hot loops iterate an **array of two-element arrays** and destructure each
one:

```ts
// lifecycle.ts — runs on EVERY scanned cell, every tick
const CONTACTS: readonly (readonly [number, number])[] = [[0,1],[0,-1],[-1,0],[1,0]]
for (const [dx, dy] of CONTACTS) { ... }
```

```ts
// growth.ts — REACH (3 offsets) and TOUCHING (4 offsets, inside a loop over REACH)
for (const [ox, oy] of TOUCHING) { ... }
```

`for...of` over an array takes the iterator protocol, and array destructuring
takes it again per element. In a loop that runs on every occupied cell of the
world sixty times a second that is real allocation and real GC pressure — and
`growth.ts` nests it, so a moss cell with three candidates does up to twelve of
them per tick.

**What to change:**

- `apps/silt/src/sim/lifecycle.ts` — replace `CONTACTS` with a flat
  `Int8Array` (or two `const` arrays, or four unrolled calls) and walk it with
  an indexed `for` loop. Four contacts is small enough that unrolling is a
  legitimate option; take whichever reads best.
- `apps/silt/src/sim/growth.ts` — same for `REACH` and `TOUCHING`. `crowding`
  is the one to care about: it is the inner loop.

**The comments on these constants are load-bearing** and explain *why* the sets
are what they are — orthogonal-only contacts, up-first reach, the diagonal
argument in `TOUCHING`. Carry every one of them across. This is a change to how
the offsets are stored, not to what they are.

**Watch out for:**

- **Order is semantics, not style.** `CONTACTS` is "first matching pair wins"
  and `REACH` is "up first, then the sides" — the comment in `growth.ts` spells
  out that falling through on a failed draw is exactly what it refuses to do.
  Keep the visiting order byte-identical or the world changes.
- **The RNG stream must not shift.** `applyReactions` draws only once a pair
  actually matches, and `growth` draws only once a neighbour qualifies. Neither
  may start drawing earlier or more often.
- `growth.test.ts`, `lifecycle.test.ts` and the determinism test are the guard.
  If any of them needs editing, the change is wrong.

While you are in `kernels.ts`, check it for the same pattern — the audit did not
find one there, but confirm rather than assume.

**Expected:** a modest but free win, biggest in plant-heavy and reaction-heavy
worlds (`plant growth` and `reaction churn` in the bench).

- [ ] No `for...of`-with-destructuring left in a per-cell path under `src/sim`
- [ ] Visiting order identical; every explanatory comment preserved
- [ ] `growth.test.ts` / `lifecycle.test.ts` / determinism green without edits
- [ ] Bench before/after in the PR description, with scanned counts
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
