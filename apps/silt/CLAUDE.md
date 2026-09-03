# apps/silt — scoped rules

A falling-sand cellular-automaton playground at `silt.homeofed.com`.
**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
client-side simulation, scenes in `localStorage`, nothing server-owned.
Scaffolded from `templates/starter`
([ADR 0007](../../docs/adr/0007-reference-starter-app.md)). Spec:
`.scratch/sand-sim/spec.md` (v1) and `.scratch/silt-materials/spec.md`
(materials); tickets in `.scratch/silt/` and `.scratch/silt-materials/`. Every
effort since carries its own spec and tickets under `.scratch/silt-*/` - most
recently `.scratch/silt-life-followup/` (the seed bank, the land plant and the
water cycle; tuning and scenes still to come).

The whole app is one route. There is no data-fetching frontend path at all —
the world lives in the browser, so the backend surface is `/health` plus the
starter's `greeting` procedure, kept only as the layered-DI seam later server
features would slot into:

```
HomePage → useSimLoop → SimHost + Renderer  (the app; the sim ticks in a
         → useScenes  → SceneStore           worker over shared memory —
router → GreetingHandler → ctx.auth          ADR 0036; scenes: localStorage)
```

## Layout

```
src/
  sim/              the simulation engine — headless, DOM-free, worker-ready
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    handlers/       Handler classes — business logic, AppContext only, no Store
    router.ts       tRPC router; createTRPC<void>() (no Store); exports AppRouter
    simulator.ts    backendSimulator wiring: real router, no Store, no PGlite
    main.ts         prod entrypoint: createAppServer + shallow /health
    headers.ts      COOP/COEP on every response — cross-origin isolation for
                    the sim worker (ADR 0036); dev and CT serve the same pair
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/            HomePage — the rail, header, status bar, selection state
  hooks/            useArmedConfirm (two-click confirms), useSiltHotkeys (the
                    global keydown map, given the actions it dispatches)
  features/         palette/ (the paintable roster + brush widths)
                    render/  (letterboxFit, the grid palette — 256 species ×
                              `VARIANT_SLOTS` variant slots, indexed by
                              `paletteSlot` from both frame paths and by the
                              same arithmetic in the shader (ADR 0040) — the
                              WebGL2 renderer +
                              the Canvas 2D fallback and createRenderer picking
                              between them, WorldOverlay — the chrome drawn
                              over the canvas)
                    sim/     (useSimLoop — the render loop, pointer painting,
                              DPR fit; simHost — worker vs main-thread hosting
                              behind one seam; simWorkerCore — the ticking
                              brain, vitest-covered; simWorker — the entry
                              glue; simProtocol — messages + shared buffers.
                              ADR 0036)
                    spawners/(continuous emitters — entities, not cells)
                    scenes/  (sceneCodec: pure format; sceneStore: localStorage +
                              quota; useScenes: page state; the popover)
  docs/             interactionGraph - derives the element graph from the live
                    registry and renders docs/interaction-graph.md; pure, so the
                    drift test can regenerate and compare
  testing/          IwftApp harness (in-browser backend) + iwft fixture + SiltPagePom
  *.iwft.tsx        whole-frontend tests: render (paint/canvas), blit (WebGL↔2D
                    pixel parity + the env-gated blit bench), chrome, scenes,
                    spawners, mobile
vite.config.ts      react + simulatorPlugin (dev simulator mode) + COOP/COEP
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3109, crossOriginIsolated: true })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, `drizzle.config.ts`, or
`@hoe/db` dependency — a stateless app has none of these.

## The simulation engine (`src/sim/`)

Pure TypeScript, no DOM, no `Math.random()` — see `.scratch/sand-sim/spec.md` §5–6.

```
constants.ts  GRID_WIDTH/HEIGHT (300×200, build-time), cell byte offsets, tick rate,
              CHUNK_SIZE / CHUNK_MARGIN (tunables, not commitments)
types.ts      ElementDef / Archetype / Api / Lifetime / Emission / SetOptions /
              ReactionRow
elements.ts   pinned species ids + the roster (dirt, sand, water, lava, obsidian,
              wood, oil, fire, smoke, steam, acid, stone, sulphur, mud, seed,
              moss, vine, ember, ash, buried, sprout, tip, stalk, flower,
              petal) and v1Reactions - config plus six hooks. Everything
              that forms a mass declares four shades rather than one, picked
              per cell by `rb` (ADR 0040); `colours[0]` is the base, because the
              rail reads it. The three gases stay flat. Gas densities
              read backwards: `canDisplace` is `mine > theirs`, so the gas
              closest to zero rises highest. Reaction row order is load-bearing:
              a specific pair must precede any tag row covering it (acid + wood,
              the `fire + <fuel>` ignition ladder above `fire + flammable`, and
              `lava + wood` above `lava + flammable`). Wood never becomes fire
              directly - it chars to ember, which creeps, erupts, is doused
              back to wood, or is burned down to ash, which rain wets to mud
              and a seed regrows (ADR 0042). Fire drying a bed leaves **steam**,
              not smoke, so a wildfire rains on its own ashes, and a burning
              plant splits by wetness rather than by a probability the engine
              cannot express - stem and tip burn, sprout and flower steam
              ([ADR 0045](../../docs/adr/0045-silt-the-water-ledger.md)). A seed
              on wet soil no longer
              sprouts on contact - it buries (`seed + mud -> buried`, p 0.1),
              because one row per pair cannot both sprout and bury (ADR 0043).
              A withering flower leaves a seed where it stood and throws 3-4
              petals clear (`lifetime.emits`); a petal is a slow floating powder
              that strikes back into a seed on wet soil (p 0.01) and, as garnish,
              on water (p 0.001). A loose seed rots after 1280-2000 ticks - the
              buried one does not, and that is why they are two species
growth.ts     the roster's first `onTick`: moss and vine grow into water, up
              first, capped per cell by a branch count kept in `ra` and bounded
              overall by refusing any cell that already touches two plants
seedBank.ts   the second `onTick`: a buried seed soaks (counter in `ra`), sleeps
              while roofed, and germinates once the sky above it opens - moss if
              2 cells of water have stood over it for 120 continuous ticks,
              otherwise the land sprout. The soil cell is refunded as dirt,
              never mud: the plant drank it. See
              [ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md)
stalk.ts      hooks three and four, the land plant: a sprout raises a stalk tip
              into empty air (never into water) and is spent becoming the base
              of the stem; the tip climbs at p 0.3 on a travelling energy budget
              in `ra`, leaving inert stalk behind, and blooms when the budget
              runs out or when it is boxed in. Stem and flower are the products
              and both crumble - a meadow of immortal columns silts up (ADR 0043)
petals.ts     the fifth `onTick`, and the smallest: a living flower sheds a petal
              at p 0.005 a tick. The *death* drop is not a hook - `onTick` never
              runs on the tick a lifetime expires, so the engine scatters the
              brood (ADR 0043 §4). The one hook needing no keep-awake write: the
              flower's own countdown already writes every tick
evaporation.ts the sixth hook, and the only one on an element that was always
              here: a one-cell film of water - open air above, something other
              than water below - lifts as steam. A pond and a level two-deep pool
              have no film anywhere in them, so both are permanent by
              construction; steam overhead counts as "not open air", which is the
              humidity brake. The one hook owning no byte, and so the one that
              made `keepAwake` public
              ([ADR 0044](../../docs/adr/0044-silt-thin-film-evaporation.md))
emit.ts       emitInto - scattering a brood into the empty cells around one cell,
              shared by `lifetime.emits` and the shedding hook. Displaces
              nothing, so a crowded flower simply sheds fewer
registry.ts   createRegistry — boot-time validation; refuses a bad roster. Also
              flattens the tag-keyed reaction table into an id-pair lookup
grid.ts       one ArrayBuffer, interleaved { species, ra, rb, clock } per cell;
              also the one chokepoint keeping chunk dirty rects + counts true
chunks.ts     Chunk / ChunkMap — two dirty rects swapped at frame end, 2-cell
              margin, filled-cell count; `all` is the fixed row-major order
moves.ts      DeferredMoves — the cross-chunk move queue and its PRNG tie-break
api.ts        CellApi — the chunk-relative (dx, dy) surface, one reused cursor
kernels.ts    applyArchetype — the only code that moves cells. Liquids keep
              their lateral direction, momentum and seeded flag packed in `ra`
              (the "opinion field", ADR 0038) instead of re-rolling a coin, and
              a liquid still carrying momentum falls diagonally in its parity
              direction rather than straight down (ADR 0041); a blocked powder
              tries one random diagonal, not both (ADR 0039). Powders take the
              same optional `move` throttle as fluids, so a petal can be a slow
              powder rather than a pooling liquid (life ticket 01)
lifecycle.ts  applyReactions / applyLifetime — what happens to a cell after it
              has moved; neither moves anything. `lifetime.every` makes the
              countdown coarse - the byte counts draws, not ticks, so a life
              longer than 255 ticks fits; the phase is the world's tick, so
              `jitter` (coarse too) is the only thing spreading a cohort out.
              `lifetime.emits` is the death drop: `becomes` rewrites the dying
              cell, `emits` scatters a brood into the free cells around it,
              because a product has no way to act on its own death (ADR 0043 §4)
sim.ts        the world: chunk scan order, the clock guard, paint/tick
loop.ts       FixedTimestep — the tick rate, decoupled from any render loop
```

Engine decisions that are not in the spec are in
[ADR 0028](../../docs/adr/0028-silt-simulation-engine.md).

Rules that are easy to break by accident:

- **Archetypes own movement, hooks own transmutation.** An element that needs
  new *motion* is a bug against the archetype set (closed at four, held closed
  by an exhaustive switch), not a new hook. Reactions are rows in the table, not
  element code.
- **Per-cell order is movement → reactions → lifetime → `onTick`**, each gated
  on the last, so an element's code never runs on a cell it no longer is.
- **A cell that should keep acting must write, or call `api.keepAwake()`.**
  Chunk sleeping is driven by writes, so a `move` probability that does not come
  up would otherwise freeze a liquid in mid-air, and a powder that drew the one
  diagonal it could not take would sit frozen in its notch (ADR 0039). The
  judgement is whether *this* cell still has business next tick — declining a
  step is not the same as having nowhere to step. Not every decline qualifies:
  the liquid kernel's stray gate deliberately lets a lone droplet settle
  ([ADR 0038](../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md)).
- **No `Math.random()` under `src/sim`.** Randomness comes from the sim's `Rng`
  via `api.rand()` / `api.randInt()`; the determinism test guards this.
- **`Api` is `(dx, dy)`-relative only**, never absolute — chunked iteration
  depends on it. Out of bounds reads the WALL sentinel.
- **Chunking must not touch determinism.** The two traps: cross-chunk
  destination contention is broken by `rng.randInt`, never by arrival order,
  and chunk order is a row-major array indexed arithmetically — never a `Map`.
- **Chunk sleeping and the clock guard.** Sleeping cells go unstamped, so each
  tick opens by re-stamping everything it is about to scan with the settled
  clock. Drop that pass and the 256-tick byte wrap starts skipping cells.
- **`Grid.stamp` must never mark a chunk dirty** — it runs on every occupied
  cell each tick, so nothing would ever sleep.
- **Byte ownership**: `lifetime` owns `ra` (engine-managed — an element never
  writes it; `0` means "not seeded yet"), colour variant owns `rb` — **seeded at
  birth, preserved by `restore`**: `Grid.write` takes the variant as an argument
  and `Sim.paint` / `CellApi.set` / `CellApi.become` each pass a fresh
  `randInt(256)`, so a transmuted cell does not fall back to variant 0; only
  `Sim.restore` takes the default, because it puts the saved plane back straight
  after. No element writes it either.
  [ADR 0040](../../docs/adr/0040-silt-colour-variants-in-rb.md).
  The one exception to the clearing of `ra` is `CellApi.set` / `Sim.paint`'s
  optional `{ ra }` (life ticket 01) - how a travelling per-cell budget reaches
  the cell a hook creates, and how a built scene pre-ages its cells. `rb` still
  reseeds, and seeding `ra` on a species that declares a `lifetime` throws at
  the call site (`requireRaIsFree`): the registry cannot see it at boot, since
  which species a hook seeds is known only when it seeds it. That guard bites on
  seed 15 since life ticket 04 gave it one - a built scene cannot pre-age a loose
  grain, only the plants that own their byte.
  New per-cell fields are parallel grids; the cell never widens past 4 bytes. There are
  **four exceptions, all conditional on the element declaring no `lifetime`**,
  and none can collide: the claim is per *species*, and a cell is one species
  (ADR 0043):
  - **The growth hook** (`growth.ts`): moss and vine hold their branch count in
    `ra`. Giving either a lifetime hands the byte back and uncaps growth.
    [ADR 0035](../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md) §3.
  - **The liquid opinion field** (`kernels.ts`): a liquid keeps its lateral
    direction, momentum and seeded marker in `ra` — bit 0, bits 1–3, bit 7.
    Unlike growth this one is *enforced*, not just documented: the scan passes
    `applyArchetype` a `raIsFree` flag, so a liquid that declares a lifetime
    degrades to the old coin flip instead of corrupting its countdown.
    [ADR 0038](../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md).
  - **The seed bank** (`seedBank.ts`): a buried seed holds its soak counter in
    `ra`, which is why the seed is *two* species - a grain that falls and burns,
    and a buried one that counts and cannot. Every living thing this epic adds
    splits the same way, into a grower that owns the byte and a product that
    expires.
    [ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md).
  - **The stalk tip** (`stalk.ts`): the tip holds its travelling energy budget in
    `ra` - height + 1, so 1 is spent and 0 (unseeded) blooms on the spot rather
    than climbing forever. Same split as the seed: the tip grows and cannot die,
    the stalk behind it expires and cannot grow.
    [ADR 0043](../../docs/adr/0043-silt-growers-and-products-split-the-byte.md) §2.1.

  This entry and the comments at all four sites are summaries of those ADRs, so
  a change to the rule belongs in the ADR first. The **fourth** claimant was the
  trigger to revisit the byte itself; the revisit is ADR 0043 §2.1 and it held.
  The next one fires the same way - and it is not about the count: a claimant
  that is anything other than a grower which never dies is the argument for
  widening the cell rather than for adding a row here.
- **`Api` reaches a neighbour's `ra` nowhere; `MovementApi` does.** `raAt` /
  `setRaAt` exist for the liquid kernel's opinion contagion and are engine-only
  on purpose (`keepAwake` no longer is - see the next rule) - an element hook
  scribbling on another cell's engine-owned byte is the failure mode the
  ownership rule exists to prevent.
- **A cell that must go on acting has to write, or say so.** Chunk sleeping is
  driven by writes, so a hook that must keep being offered a draw either rewrites
  a byte it already owns or calls `api.keepAwake()` - `growth.ts` writes `ra`
  every tick it has water to reach, because settled water writes nothing and the
  chunk would sleep under the plant, `seedBank.ts` writes its soak for the same
  reason, and the stalk tip re-states its budget on any tick its climb draw
  misses. Each of those three writes a byte it already owns, and the rule was
  that **a hook that would have to write a byte it otherwise has no use for is
  the trigger to promote a real `keepAwake` onto `Api`** (life spec §8) - which is
  why the sprout raises its tip with no probability at all rather than drawing
  for it. **That trigger has now fired**: `evaporation.ts` lives on water, whose
  `ra` is the *enforced* liquid opinion field, so it has no byte to disguise a
  write in and `keepAwake` is public
  ([ADR 0044](../../docs/adr/0044-silt-thin-film-evaporation.md) §3). It stays
  judgement rather than a convenience: the question is whether *this* cell still
  has business next tick. A film that declined its draw does; a pond surface,
  which is not a film at all, does not - and calling it there would hold every
  pond in the world awake for ever. The mirror image matters as much: a *dormant*
  buried seed, a roofed sprout and a roofed film write nothing at all, which is
  what lets the bed under a crowded meadow sleep.
- **`CHUNK_MARGIN` is fully spent.** The crowding check in `growth.ts` reads two
  cells out (the candidate is one away, its neighbours one past that), and the
  seed bank's depth test reads exactly two up - both are exactly the margin. A
  write wakes every chunk within two cells of it, so nothing is missed, but
  there is no slack left. A hook that needs a third cell
  needs the margin raised in the same change. See
  [ADR 0035](../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md).
- **Species ids are pinned**, but scenes remap by *name*: the envelope's
  `elements` table records what each byte meant, so renumbering an id is safe
  and renaming an element silently empties those cells (with a warning).
- **Latest-value refs sync in a `useEffect`, never during render.** A
  long-lived listener (keydown handler, RAF loop) that needs current React
  values without re-binding reads them off a ref; that ref is written from one
  `useEffect` (no dependency array, syncing every value it owns), not
  `ref.current = x` inline in the render body — the render-phase form misbehaves
  under concurrent rendering and StrictMode double-invocation (ticket 15).

## Scene persistence (`src/features/scenes/`)

Spec §8; the calls the spec leaves open are in
[ADR 0029](../../docs/adr/0029-silt-scene-persistence.md).

- `sceneCodec.ts` is **pure and DOM-free** — keep it that way; it is why the
  remap, dimension-mismatch and corruption rules are vitest cases, not browser
  ones. `decodeScene` hands back planes already sized to the current grid.
- `sceneStore.ts` talks to `localStorage` through the `SceneStorage` interface,
  writes the blob **before** the index, and turns quota errors into
  "storage full, delete a scene".
- **Save writes over the current scene** (`store.update`), so one scene costs
  one blob and one thumbnail however many times it is saved; only an unsaved
  world creates a row. `copy` is how a variant is forked. `useScenes` owns
  which scene is current, and the header reads its name from there.
- **Never destructive on failure**: a scene that will not load keeps its blob
  and its row, and gains an error. A load always enters paused.
- `ra`/`rb` are persisted; `clock` is not (it is zeroed by `Sim.restore`).

## Commands

- `pnpm dev --filter=silt` — simulator mode on port **3009** (real router, no
  persistence; restart to pick up server changes).
- `pnpm test --filter=silt` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`, CT port **3109**).
- `pnpm --filter silt run bench` — `bench/sim.bench.ts`, ms/tick for five named
  scenarios under native Node. A tool, not a gate: it is deliberately outside
  `pnpm test`, since a timing assertion in CI would only flake. It prints
  `scannedLastTick` beside every timing — a scenario that got faster because it
  stopped simulating is not a win, and the scanned count is what tells the two
  apart.
- `pnpm --filter silt run graph` — rewrites
  [`docs/interaction-graph.md`](docs/interaction-graph.md) (mermaid graph plus a
  row-by-row table) from the registry. Unlike `bench` this one **is** gated:
  `src/docs/interactionGraph.test.ts` fails if the checked-in file has drifted,
  so a new element or reaction row means running the script in the same change.
  Hooks are the edges the registry cannot report: growth's are declared in the
  generator, so a change to `growth.ts` has to be mirrored there, while the seed
  bank's germination and the land plant's two hooks are unreported entirely - a
  `GrowthEdge` has no shape for a rule that writes two cells (ADR 0043), nor for
  evaporation, which consumes no neighbour and is all condition. A
  coarse `lifetime` is reported in real ticks, not in countdown draws, and a
  `lifetime.emits` death drop is reported beside the decay it rides on.
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3009, CT 3109.
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
