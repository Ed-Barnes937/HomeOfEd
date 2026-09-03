# 0040 — silt: colour variants ride in `rb`, seeded at birth

- **Status:** Accepted
- **Date:** 2026-08-28
- **Related:** `.scratch/silt-sandspiel/spec.md` and ticket 03
  (`.scratch/silt-sandspiel/issues/03-rb-colour-variants.md`);
  [ADR 0028](0028-silt-simulation-engine.md) for the engine and its byte
  ownership; [ADR 0029](0029-silt-scene-persistence.md) for the saved planes.
  Implemented in `apps/silt/src/sim/{constants,types,grid,api,sim,elements,registry}.ts`
  and `apps/silt/src/features/render/{speciesPalette,renderer,webglRenderer}.ts`.

## Context

Every species rendered as one flat colour, so a pile of sand was a slab. The
seam for fixing it had been declared since v1 and never built:

- `ElementDef.colours` was documented as "at least one `#rrggbb`; the renderer
  picks a variant via `rb`", but `buildSpeciesPalette` only ever read
  `colours[0]`.
- Byte ownership already assigned `rb` to colour variant, and nothing else
  wrote it — `grid.write` cleared it to 0 and no code ever set it, so every cell
  in the world was variant 0.
- The WebGL renderer already uploaded `rb` to the GPU in the B channel with a
  comment reserving it "for later per-cell variance shading".

Sandspiel modulates per-cell shading from a scratch byte, and the teardown named
it as most of why its matter reads as *grains* rather than as regions of colour.

## Decision

### 1. A fixed eight-slot variant window, folded at build time

The ticket proposed a 256×V palette with each species' variant count packed into
the alpha of its variant-0 texel, and `rb % count` evaluated per pixel on both
frame paths. That works, but it puts a second lookup and an integer division in
the hottest loop in the app — the 2D rasterise loop runs once per cell per frame
and was measured in the perf epic.

Instead the palette gives **every** species exactly `VARIANT_SLOTS = 8` slots and
fills them by cycling its declared colours. Both paths then index

```ts
// speciesPalette.ts — the one copy of this arithmetic
export function paletteSlot(species: number, rb: number): number {
  return species * VARIANT_SLOTS + (rb & (VARIANT_SLOTS - 1))
}
```

— one indexed load per pixel, no count, no division, no alpha packing (the
engine turns a power-of-two multiply and a mask into shifts). The GPU
palette texture is 8×256 (species on the y axis, so texture rows are exactly the
CPU table's rows) and the fragment shader does a single `texelFetch`. The whole
table is 8 KB either side.

`VARIANT_SLOTS` lives in `sim/constants.ts`, not in the renderer, because the
registry enforces it at boot: `rb` is a sim byte, so the slot count is a contract
between the two sides rather than a render-only detail. It is the same shape as
`MAX_LIFETIME_TICKS`, which the registry enforces on behalf of `ra`. The shader
interpolates its mask from the same constant it sizes the texture from, so the
only thing left that can drift between the paths is the *shape* of the
expression — which is what the parity gate is for.

The trade is that a species declaring a count that does not divide 8 gets a bias
of one slot in eight on its earlier colours. That is invisible, and the roster
avoids it anyway by declaring four shades. The registry refuses a ninth colour at
boot, since no `rb` could ever index past the last slot.

### 2. `rb` is seeded wherever a cell is born, from the sim PRNG

`Grid.write` — the one chokepoint for creating a cell — takes the variant as an
argument rather than clearing it. The three birth sites pass a fresh
`rng.randInt(256)`:

- `Sim.paint`, which is also how spawners emit;
- `CellApi.set` and `CellApi.become`, seeded centrally in the cursor rather than
  at each call site, so a transmutation cycle (water → steam → water) does not
  collapse back to variant 0 and flatten the cloud into a slab.

`Sim.restore` is the one caller that does not seed. It passes `0` explicitly and
then puts the saved `rb` plane back verbatim, so a reloaded scene keeps the exact
grain it was saved with.

**The parameter is required, with no default.** A default of `0` is precisely the
bug this ADR fixes, left lying around for whatever calls `write` next; making
every caller state its intent is the same shape as ADR 0038 *enforcing* the
liquid kernel's `raIsFree` rather than merely documenting it.

Storing a full random byte and letting the renderer take the low three bits is
deliberate — the sim does not know, and must not know, how many colours an
element has.

**This is a change to the RNG stream, not to determinism.** Every draw comes from
the sim's seeded `Rng` in tick order, so same seed plus same input still gives
the same world, byte for byte. It does mean world states are not comparable
across this change; nothing depended on that.

### 3. Four shades for everything that forms a mass; gases stay flat

Everything that forms a mass declares four shades — the base colour at
×1.00, ×0.90, ×1.08 and ×0.96, roughly ±10% of luminance. That was fourteen of
seventeen elements when this landed, and sixteen of nineteen once the burnables
effort added ember and ash ([ADR 0042](0042-silt-wood-smolders-as-ember.md));
the count moves with the roster, the rule does not. Two rules hold:

- **`colours[0]` is the base and stays in slot 0**, because the rail swatch reads
  `colours[0]` and the rail must not drift from the canvas (spec §9).
- **Four divides eight**, so the shades come up in equal shares.

Fire, smoke and steam keep their single colour. Their motion already breaks up
the mass, and the gas archetype is the one the sandspiel spec flags as possibly
changing later — an isotropic-walk gas would want `rb` for its molecule count, so
leaving it unclaimed there costs nothing today. A single-colour species is flat
across all eight slots and renders exactly as it did before variants existed.

## Consequences

**Byte ownership is unchanged; the owner finally uses it.** `rb` was already
colour variant's, and no element hook writes it — seeding lives in the engine
(`Grid`, `CellApi`, `Sim`), which is the same shape as `lifetime` owning `ra`.
The `apps/silt/CLAUDE.md` entry gains the two facts a reader now needs: seeded at
birth, preserved by `restore`.

**The parity gate got stronger.** `blit.iwft.tsx` previously compared the WebGL
framebuffer against the CPU palette table. It now reads back *both* on-screen
canvases — WebGL and Canvas 2D — and compares each against the palette, over a
run of same-species cells with mixed variants. The shader indexes the table with
its own arithmetic and the 2D loop with its own, so either drifting fails there
rather than merely looking wrong.

**Cost is noise, on both benches.** The blit bench (headless, software GL,
1240×800) moves from the perf epic's recorded 0.63 ms/frame to 0.645–0.661 over
three runs: the rasterise loop reads a second byte and does two more ALU ops, and
still performs one indexed load and one 32-bit store per pixel. `paletteSlot` is
called there rather than hand-inlined, which was measured rather than assumed —
0.652 against 0.657 for the inlined form, i.e. V8 inlines it and one copy of the
arithmetic costs nothing. `pnpm --filter
silt run bench` moves 0.561 → 0.580, 0.623 → 0.632 and 0.744 → 0.733 ms/tick;
the tick never reads `rb`, and the extra PRNG draws are per *birth*, not per
cell. (The scanned counts differ across the two runs because the RNG stream
shifted, so those numbers compare worlds that evolved differently — which is the
honest caveat on treating them as a like-for-like delta.)

**Scenes are already covered.** The codec has always persisted `rb`, so saved
worlds round-trip their grain with no format change.
