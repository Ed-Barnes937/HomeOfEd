# 03 — Per-cell colour variants via `rb`

**Status:** done
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

## Answer

Done. Reasoning and numbers in
[ADR 0040](../../../docs/adr/0040-silt-colour-variants-in-rb.md).

**One deliberate deviation from the design above: the variant window is a fixed
eight slots, folded at build time, not 256×V with a count in alpha.** The ticket
put a second lookup and an integer modulo per pixel in the 2D rasterise loop —
the hottest loop in the app. Instead every species gets exactly
`VARIANT_SLOTS = 8` slots, filled by cycling its declared colours, and both frame
paths plus the shader index the same way:

```ts
export function paletteSlot(species: number, rb: number): number {
  return species * VARIANT_SLOTS + (rb & (VARIANT_SLOTS - 1))
}
```

One indexed load per pixel, no count, no division, no alpha packing. The GPU
palette texture is 8×256 with species on the y axis, so its rows *are* the CPU
table's rows and one `texelFetch` does it. The table is 8 KB either side, against
the ~4 KB the ticket's shape would have used. The cost is a one-slot-in-eight
bias for a species whose colour count does not divide 8 — invisible, and the
roster declares four shades so it does not arise. The registry refuses a ninth
colour, since no `rb` could ever index past the last slot.

The rest is as specified. `Grid.write` takes the variant as a **required**
argument rather than clearing it — a default of 0 is the bug itself, left lying
around for the next caller; `Sim.paint` (so spawners too), `CellApi.set` and
`CellApi.become` each pass `rng.randInt(256)`, and `Sim.restore` passes 0
explicitly then puts the saved plane back. Fourteen elements get four shades at
×1.00/×0.90/×1.08/×0.96 of the base; fire, smoke and steam stay flat.

`VARIANT_SLOTS` lives in `sim/constants.ts`, beside `MAX_LIFETIME_TICKS`, not in
the renderer: the registry enforces it at boot, so it is a contract between the
sim and the render side rather than a render-only detail. The shader
interpolates its mask from the same constant it sizes its texture from.

**The seeding-in-`CellApi` call was not contentious, but it does move the RNG
stream.** Determinism holds — every draw is from the sim's seeded `Rng` in tick
order — but world states are no longer comparable across the change. Nothing
depended on that.

**The parity gate is now genuinely three-way.** It read the WebGL framebuffer
against the CPU palette table before; it now reads *both* on-screen canvases and
compares each against the palette, over a 71-cell run of one species with mixed
variants, asserting all four shades appear. The shader and the 2D loop index the
table with their own arithmetic, so either drifting fails there.

**Cost is noise on both benches.** Blit bench (headless, software GL, 1240×800):
the perf epic's recorded 0.63 ms/frame → 0.645 / 0.651 / 0.661 over three runs.
The hot loop *calls* `paletteSlot` rather than hand-inlining it, which was
measured rather than assumed: 0.652 against 0.657 for the inlined form, so V8
inlines it and keeping one copy of the arithmetic is free.
`pnpm --filter silt run bench`: 0.561 → 0.580, 0.623 → 0.632, 0.744 → 0.733
ms/tick — and the tick never reads `rb`, the extra draws being per birth rather
than per cell. Those tick numbers compare worlds that evolved differently, since
the stream shifted, so treat them as "nothing showed up", not as a clean delta.

**One pinned test moved**, `paletteRegistrySource.test.ts`, which indexed the
palette at `id * 3`; it now asks for slot 0 explicitly, which is the property
that actually matters (the rail reads `colours[0]`, and slot 0 is where it
lives). Everything else was green without edits.

## Comments

- 2026-08-28 — `/code-review` (standards + spec). No behavioural defect on
  either axis. Both found the same class of problem — **documentation that had
  drifted from the code it describes** — and between them named six places:

  - `types.ts` still told a hook author that `Api.set` "clears its scratch
    bytes", which is exactly what stopped being true. That is the one file an
    element author reads, so it was the worst of the six. Fixed, along with
    `become`, `colours` (which never mentioned the new cap) and `rb`.
  - `apps/silt/CLAUDE.md`, ADR 0040 and this ticket all quoted
    `(species << 3) | (rb & 7)` — an expression the late `paletteSlot` refactor
    had removed. All three now quote the function as written.
  - `BlitProbeCell`'s doc omitted the `canvas2d` field the gate now asserts.

  Two design points were taken as well, both hardening rather than fixes:

  - **`VARIANT_SLOTS` moved to `sim/constants.ts`.** It was `MAX_COLOURS = 8` in
    the registry and `VARIANT_SLOTS = 8` in the palette, unlinked, so changing
    one would have silently left the boot check wrong. The sim cannot import
    from `features/render`, so the fix was to put the constant on the side that
    both can reach. `MAX_LIFETIME_TICKS` — a limit the registry enforces on
    behalf of `ra` — is the precedent that made the placement obvious.
  - **`Grid.write`'s `rb` lost its `= 0` default.** Spec review also noted the
    shader hard-coded `& 7u`; it now interpolates `VARIANT_SLOTS - 1`, so the
    only thing that can still drift between the paths is the shape of the
    expression, which is what the parity gate is for.

  Spec review's one genuine gap: the ticket asked for a **spawner** seeding test
  and only paint / become / restore had one. Emission was correct by
  construction — `emitSpawners` calls `sim.paint` — but nothing held it there.
  Added to `spawners.test.ts`.

  Declined: `Sim.rbAt` was flagged as public API with no production caller. It
  mirrors `speciesAt`, it is the read accessor for the byte this whole ticket is
  about, and the alternative is duplicating cell-index arithmetic in two test
  files. Kept. Also noted and left: `CellApi.set` draws its variant before
  `grid.write`'s bounds check, so the stream tracks attempted rather than
  effective writes — deterministic either way, so not a defect.
