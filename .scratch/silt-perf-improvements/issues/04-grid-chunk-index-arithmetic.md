# 04 — Grid and chunk index arithmetic, and the clock-guard pass

**Status:** ready-for-agent
**Type:** task
**Blocked by:** 01
**Spec:** [../spec.md](../spec.md)

Three related costs in the innermost layer of the engine.

## 1. Every cell read recomputes its own byte index

`Grid.speciesAt` → `inBounds(x, y)` then `#at(x, y, field)`, which is
`(y * this.width + x) * BYTES_PER_CELL + field`. So does `clockAt`, `raAt`,
`rbAt`, `stamp`, `setRa`, `setRb`. `CellApi.get` goes through `speciesAt` and is
called ten to twenty times per cell per tick.

The worst offender is `Sim.#scanChunk`, which for one cell does
`speciesAt(x, y)`, then `clockAt(x, y)`, then `stamp(x, y, clock)` — three
independent recomputations of the same base index, plus three bounds checks on
coordinates the loop already knows are in bounds.

**What to change:** compute the base index once per cell in `#scanChunk` and
read the three fields off it directly. `Grid` can expose a narrow
`baseIndexOf(x, y)` (or the scan can keep a running row base and add `x`), but
whatever shape you pick, `Grid` stays the only place that knows the layout —
the encoding comment on `indexOf` is the rule and it stands.

`#at` also multiplies twice. `(y * width + x) * 4` is one shift when
`BYTES_PER_CELL` is 4: `((y * width + x) << 2) + field`. Keep it derived from
the constant, not hard-coded to 4 — a static assert or a comment tying the
shift to `BYTES_PER_CELL` is the honest form.

## 2. `Math.floor` on values that are already non-negative

`ChunkMap.indexAt` does two `Math.floor` calls and is invoked **twice on every
`CellApi.swap`** (source chunk and destination chunk) — that is on the path of
every single cell that moves. `ChunkMap.#spread` does four more, and `#spread`
runs on **every grid write**, via `touch`.

`Grid.yOf` does the same, on the deferred-move path.

All of these operate on coordinates already known non-negative, so `| 0` is
equivalent and far cheaper. Better still: `CHUNK_SIZE` is 32, a power of two,
so `y / size | 0` is `y >> 5`. Derive the shift from the size at construction
and **fall back to division when the size is not a power of two** —
`ChunkMap`'s constructor takes `size` as a parameter and `chunking.test.ts`
passes odd sizes, so the non-power-of-two path must keep working.

## 3. The clock-guard pass reads and writes through the full accessor stack

`Sim.#restoreClockGuard` is a **second complete traversal** of every awake
chunk's active rect, before the scan proper, calling `grid.stamp(x, y, settled)`
per cell — bounds check plus index recomputation each time.

The rect is contiguous in x for a fixed y, and cells are 4 bytes with the clock
at offset 3, so a row is a strided write over a known range. Give `Grid` a
`stampRow(y, minX, maxX, clock)` (or `stampRect`) that walks the bytes directly,
and have `#restoreClockGuard` call it once per row instead of once per cell.

**`Grid.stamp` must never mark a chunk dirty** — the whole reason it is exempt
is that it touches every occupied cell each tick and nothing would ever sleep.
Whatever you add inherits that rule, and it is worth a comment saying so.

## Watch out for

- **Determinism.** None of this changes behaviour, so every existing test must
  pass **unedited**. If one needs a change, the change is wrong.
- **The clock guard is subtle.** Read the class comment on `Sim` before you
  touch `#restoreClockGuard`: the pass must run over *all* awake chunks before
  *any* of them is scanned, or it un-stamps a cell an earlier chunk just moved.
  Do not fold it into the scan loop.
- **Bounds checks are load-bearing at the API edge.** `Api` reads out of bounds
  return WALL and that is relied on everywhere. Only skip a bounds check where
  the caller demonstrably already established the coordinate is inside — inside
  `#scanChunk`'s own loop, yes; inside `speciesAt`, no.
- `chunking.test.ts` exercises non-power-of-two chunk sizes. Run it.

**Expected:** a broad few-percent-each win that compounds, plus roughly half of
the clock-guard pass.

- [ ] `#scanChunk` computes each cell's base index once
- [ ] `Math.floor` gone from `indexAt`, `#spread` and `yOf`; power-of-two shift with a division fallback
- [ ] `#restoreClockGuard` stamps by row, not by cell, and still marks nothing dirty
- [ ] `chunking.test.ts` green with non-power-of-two sizes
- [ ] Every existing test green **without edits**
- [ ] Bench before/after in the PR description, with scanned counts
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
