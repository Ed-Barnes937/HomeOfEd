# 03 — Per-cell colour variants via `rb`

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md)

Every species renders as one flat colour, so a pile of sand is a slab.
Sandspiel modulates per-cell shading from a scratch byte and it is most of
why its matter reads as *grains*. Silt already declares this design and never
built it:

- `ElementDef.colours` is "At least one `#rrggbb`; the renderer picks a
  variant via `rb`" (`types.ts`) — but `buildSpeciesPalette` only ever reads
  `colours[0]` (`speciesPalette.ts`).
- Byte ownership already assigns `rb` to colour variant
  (`apps/silt/CLAUDE.md`), and nothing else writes it.
- The WebGL renderer already uploads `rb` to the GPU in the B channel, with a
  comment reserving it "for later per-cell variance shading"
  (`webglRenderer.ts`).

So this ticket is finishing a seam, not adding one.

## Design

**Sim side — seeding `rb`.** Today `grid.write` clears `rb` to 0 and nothing
ever sets it, so every cell is variant 0. Seed it wherever a cell is born:

- `Sim.paint` — `rb = rng.randInt(256)` alongside the existing write.
- Spawners — same, at emission.
- Transmutation (`api.set` / `api.become`) — seed centrally in `CellApi` so
  water→steam→water doesn't collapse to variant 0. Uses `api.rand`, so
  determinism holds.
- `Sim.restore` keeps stored `rb` untouched — scenes already persist it, so
  saved worlds keep their exact grain.

Store a full random byte and let the renderer take `rb % variantCount`; the
sim should not know how many colours an element has.

**Registry.** Validate `colours` length (1–8, say) and expose the count.

**Render side — all three paths must agree** (the blit parity gate in
`blit.iwft.tsx` compares them):

- Palette becomes two-dimensional: 256 species × V variants (V = max roster
  variant count). The WebGL palette texture goes 256×V; the fragment shader
  reads `rb` from the B channel it already receives and samples
  `(species, rb % count)`. Per-species `count` can ride in the alpha channel
  of the variant-0 texel (currently a constant 255) so no extra uniform or
  texture is needed.
- The packed CPU palette (`buildPackedSpeciesPalette`, used by the 2D frame
  path) grows the same way, and its rasterise loop reads `rb` as well as
  species. That loop was measured in the perf epic — re-bench it; one extra
  byte read and a modulo per pixel is expected noise, but confirm.
- `rasteriseSpecies` (WebGL `snapshot()`, scene thumbnails) likewise.

**Roster.** Give the obvious elements 3–4 variants each (sand, dirt, stone,
water…) — shades of the existing colour, so the rail (which reads
`colours[0]`) still matches the canvas. Single-colour elements stay exactly
as they are: one entry, `rb % 1 === 0`, zero visual change.

## Tests

- Unit: palette packing (2D layout, counts in alpha, single-colour species
  unchanged), registry validation, `rb` seeding paths (paint / spawner /
  become) and that `restore` does not reseed.
- `blit.iwft.tsx` parity gate extended: shader output vs the CPU palette must
  agree cell-for-cell with mixed variants on screen.
- Determinism test green — seeding draws from the sim PRNG in tick order.

## Constraints

- `rb` ownership doesn't change — this *is* the owner finally using it. No
  ADR needed unless the seeding-in-`CellApi` call turns out contentious;
  a CLAUDE.md byte-ownership note ("seeded at birth, `restore` preserves")
  keeps the rule current.
- Rail palette must not drift from the canvas (spec §9): the rail keeps
  reading `colours[0]`.
- `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green, and
  `pnpm --filter silt run bench` for the 2D rasterise loop.
