# 05 — `DeferredMoves` without an object per move

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md)

Every move that crosses a chunk edge allocates:

```ts
push(src: number, dst: number, species: number): void {
  this.#list.push({ src, dst, species })
}
```

Three numbers, wrapped in a fresh object, thrown away at the end of the tick.
In a busy world that is hundreds of short-lived objects per tick, sixty times a
second — straight into the nursery, and the GC pauses land as dropped frames,
which is exactly the failure mode this audit is chasing.

`resolve` then sorts with a comparator closure, which on an array of objects
means pointer-chasing per comparison.

**What to change** — all inside `apps/silt/src/sim/moves.ts`:

- Hold the queue as a flat `Int32Array` (grown by doubling, never shrunk
  between ticks) with a `#count`, three entries per move: `src`, `dst`,
  `species`. Or three parallel arrays. Either is fine; pick the one that keeps
  `resolve` readable.
- Sorting: `Array.prototype.sort` cannot sort a strided flat array directly.
  Sort an index array (`Uint32Array` of move slots) with the same
  `(dst, src)` comparator, or pack `(dst << 16) | src` into a single sortable
  key when the grid is small enough for it — 300×200 is 60000 cells, which
  needs 17 bits, so **that packing does not fit in 32 bits and must not be
  used**. Sort an index array.
- `size` and `clear` keep their current meanings; `clear` sets the count to
  zero and leaves the buffer allocated.

## Watch out for

- **This is the determinism trap, and the class comment says so.** The list is
  sorted into a total order by `(dst, src)` *before* any draw, so the
  candidates a draw chooses between are in the same sequence for a given seed
  regardless of which chunk queued first. That property must survive exactly.
  A sort that is not stable on equal keys is still fine here **only because**
  `(dst, src)` is a total order with no duplicates — two moves cannot share
  both source and destination. Convince yourself of that before relying on it,
  and say so in the PR.
- **The winner draw must consume the RNG identically.** `contenders === 1`
  skips the draw entirely; keep that short-circuit or every seeded test shifts.
- `#apply` re-checks the move against the grid as it stands. Keep it — a stale
  move must be dropped, not applied.
- The determinism test and `chunking.test.ts` are the guard. Neither may need
  editing.

**Expected:** less than the registry ticket in steady-state throughput, but it
removes a GC source, and GC is what turns a 58 fps average into a visible hitch.

- [ ] No per-move object allocation
- [ ] `(dst, src)` total ordering preserved; RNG draws unchanged in count and order
- [ ] Buffer reused across ticks rather than reallocated
- [ ] Determinism and chunking tests green **without edits**
- [ ] Bench before/after in the PR description, with scanned counts
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
