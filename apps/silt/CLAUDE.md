# apps/silt — scoped rules

A basic cellular-automaton sandbox at `silt.homeofed.com`. **Stateless**
([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) — client-side
simulation, nothing server-owned. Scaffolded from `templates/starter`
([ADR 0007](../../docs/adr/0007-reference-starter-app.md)); the renderer and UI
shell land in later tickets (`.scratch/silt/`).

The simulation engine is in place (`src/sim/`, below) but nothing renders it
yet. The only route is still the placeholder rendering `trpc.greeting()` —
a value computed by the full layered path with no persistence:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
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
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
    features/scenes/  scene persistence: sceneCodec (pure format), sceneStore
                      (localStorage + quota), useScenes (page state), the popover
  testing/          IwftApp harness (in-browser backend) + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3109 })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, `drizzle.config.ts`, or
`@hoe/db` dependency — a stateless app has none of these.

## The simulation engine (`src/sim/`)

Pure TypeScript, no DOM, no `Math.random()` — see `.scratch/sand-sim/spec.md` §5–6.

```
constants.ts  GRID_WIDTH/HEIGHT (300×200, build-time), cell byte offsets, tick rate,
              CHUNK_SIZE / CHUNK_MARGIN (tunables, not commitments)
types.ts      ElementDef / Archetype / Api / Lifetime / ReactionRow
elements.ts   pinned species ids + the v1 roster (dirt, sand, water, lava,
              obsidian) and v1Reactions — pure config, zero behavioural code
registry.ts   createRegistry — boot-time validation; refuses a bad roster. Also
              flattens the tag-keyed reaction table into an id-pair lookup
grid.ts       one ArrayBuffer, interleaved { species, ra, rb, clock } per cell;
              also the one chokepoint keeping chunk dirty rects + counts true
chunks.ts     Chunk / ChunkMap — two dirty rects swapped at frame end, 2-cell
              margin, filled-cell count; `all` is the fixed row-major order
moves.ts      DeferredMoves — the cross-chunk move queue and its PRNG tie-break
api.ts        CellApi — the chunk-relative (dx, dy) surface, one reused cursor
kernels.ts    applyArchetype — the only code that moves cells
lifecycle.ts  applyReactions / applyLifetime — what happens to a cell after it
              has moved; neither moves anything
sim.ts        the world: chunk scan order, the clock guard, paint/tick
loop.ts       FixedTimestep — the tick rate, decoupled from any render loop
```

Engine decisions that are not in the spec are in
[ADR 0024](../../docs/adr/0024-silt-simulation-engine.md).

Rules that are easy to break by accident:

- **Archetypes own movement, hooks own transmutation.** An element that needs
  new *motion* is a bug against the archetype set (closed at four, held closed
  by an exhaustive switch), not a new hook. Reactions are rows in the table, not
  element code.
- **Per-cell order is movement → reactions → lifetime → `onTick`**, each gated
  on the last, so an element's code never runs on a cell it no longer is.
- **A cell that should keep acting must write, or call `api.keepAwake()`.**
  Chunk sleeping is driven by writes, so a `move` probability that does not come
  up would otherwise freeze a liquid in mid-air.
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
  writes it; `0` means "not seeded yet"), colour variant owns `rb`. New per-cell
  fields are parallel grids; the cell never widens past 4 bytes.
- **Species ids are pinned**, but scenes remap by *name*: the envelope's
  `elements` table records what each byte meant, so renumbering an id is safe
  and renaming an element silently empties those cells (with a warning).

## Scene persistence (`src/features/scenes/`)

Spec §8; the calls the spec leaves open are in
[ADR 0025](../../docs/adr/0025-silt-scene-persistence.md).

- `sceneCodec.ts` is **pure and DOM-free** — keep it that way; it is why the
  remap, dimension-mismatch and corruption rules are vitest cases, not browser
  ones. `decodeScene` hands back planes already sized to the current grid.
- `sceneStore.ts` talks to `localStorage` through the `SceneStorage` interface,
  writes the blob **before** the index, and turns quota errors into
  "storage full, delete a scene".
- **Never destructive on failure**: a scene that will not load keeps its blob
  and its row, and gains an error. A load always enters paused.
- `ra`/`rb` are persisted; `clock` is not (it is zeroed by `Sim.restore`).

## Commands

- `pnpm dev --filter=silt` — simulator mode on port **3009** (real router, no
  persistence; restart to pick up server changes).
- `pnpm test --filter=silt` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`, CT port **3109**).
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3009, CT 3109.
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
