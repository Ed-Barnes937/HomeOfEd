# 01 — Prior-art research: falling-sand games and engines

Type: research
Status: resolved

## Question

What can existing falling-sand projects teach us before locking the element
model and spec? Survey Sandspiel (and sandspiel-studio), Noita (GDC talk /
public write-ups), The Powder Toy, and any notable open-source web
implementations. Specifically:

1. How do they represent cells and elements (data layout, state-of-matter
   categories, per-cell extra state like temperature)?
2. How do they express element *interactions/reactions* (reaction tables,
   per-element update code, probabilistic rules)?
3. Update-loop mechanics: update order, avoiding directional bias, chunking /
   dirty rects, multithreading.
4. Which elements/interactions are the crowd-pleasers worth stealing for the
   post-v1 roadmap (fire, steam, acid, plants, oil...)?
5. Anything that validates or challenges our locked architecture stance
   (typed-array grid, sim/renderer split, fixed timestep, seeded determinism).

## Answer

Full findings, with sources: [`../research/prior-art.md`](../research/prior-art.md).
Primary sources read directly: Sandspiel's Rust crate (`lib.rs`, `species.rs`),
Sandspiel Studio's block reference, The Powder Toy's `Particle.h` / `Element.h` /
`ElementDefs.h` / `ACID.cpp`, the Noita wiki's datamined material and reaction
docs, plus winter.dev and jason.today for web/chunking specifics. The Noita GDC
talk's chunking details came via a write-up, not a transcript — flagged as such
in the doc.

**The whole architecture stance survives contact with the prior art.** Nothing
found challenges it; two points sharpen it.

- **Cell layout.** Sandspiel's cell is 4 bytes — `{ species, ra, rb, clock }` —
  with `ra`/`rb` as untyped scratch reinterpreted per element, and auxiliary
  fields (wind, burn) kept as *parallel grids*, never widening the cell. Even
  TPT, the richest published model, still falls back on four anonymous scratch
  ints. Adopt this shape; add future fields as parallel arrays.
- **Double-updating.** Sandspiel's `clock` byte plus a per-tick `generation`
  counter is the fix: every write stamps `generation + 1`, and the scan skips
  stamped cells. One byte per cell, keeps the sim in-place (so a single
  transferable buffer stays viable), and strictly better than double-buffering
  the grid. Note it ties correctness to *sim ticks*, so fixed-timestep decoupling
  isn't a nicety — the clock trick requires it.
- **Directional bias.** With a clock byte, scan order becomes a fairness concern
  only. Prefer Sandspiel's generation-alternating horizontal scan
  (`scanx = gen % 2 == 0 ? width - 1 - x : x`) over randomised per-row direction,
  because it consumes no RNG — which matters for our seeded-determinism stance.
- **Chunking: validated as structure, payoff deferred.** Noita uses 64×64 chunks
  with per-chunk dirty rects; winter.dev gives the implementable pattern — *two*
  dirty rects (working + current, swapped at frame end, since you can't grow the
  rect you're iterating), a 2-cell margin, a filled-cell count to skip empty
  chunks, and a **deferred cross-chunk move list** with a random tie-break when
  two cells want the same destination. Build the chunk struct and the deferred
  move list; do **not** build a thread pool. **Sharpening:** that random tie-break
  and the chunk resolution order are where chunking can silently destroy
  determinism — the tie-break must draw from the seeded PRNG and chunk order must
  be fixed. Worth writing into the spec.
- **Interactions: use both idioms.** Per-element `update(api)` against a
  relative-offset API (`get(dx,dy)` / `set(dx,dy)` / `rand()`, never absolute
  coords) as the primitive, *plus* a declarative pair-reaction table. Noita's
  reaction rows carry `probability` and `direction` and key off material **tags**
  (`[corrodible]`) rather than only concrete materials — that tagging is what
  stops the table going O(n²). Put the v1 water+lava→stone rule in the table, not
  in lava's update function, so the seam exists and post-v1 elements plug into it.
- **How little state is actually needed.** Sandspiel Studio exposes an entire
  user-facing element language as: neighbour query, swap/set, chance, direction
  vector with rotation/reflection, and exactly four per-cell registers — two of
  which are purely cosmetic. That's a hard empirical bound on element-model scope.
- **Post-v1 roadmap has one architectural gate.** Glass (sand+lava), oil-on-water
  (a `density` number) and acid (a `hardness` number, TPT-style, so acid needs no
  per-pair rules) all need only element-table numbers and reaction rows — no new
  per-cell state. Fire, smoke/steam and plants all need the *same* one thing: a
  counter byte with an engine-managed decay pass selected by an element flag
  (TPT's `PROP_LIFE_DEC`). If the cell already carries a spare scratch byte, that
  gate is already open. TPT's air/pressure grid is explicitly not worth it.
- **Lava as "slow liquid"** wants a per-element move *probability* (fractional
  velocity expressed as a per-step chance), not a velocity field.
- **Pin element ids explicitly** — Sandspiel's non-contiguous species enum is
  evidence of save-format pain, and our scenes hit localStorage from day one.

Open question left for the spec: grid and chunk dimensions. Chunk size varies by
two orders of magnitude across implementations (Noita 64×64, winter.dev ~200×200)
with no stated justification either side, so treat it as a tunable constant rather
than a spec commitment.
