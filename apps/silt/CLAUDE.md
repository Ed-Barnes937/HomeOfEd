# apps/silt — scoped rules

A falling-sand cellular-automaton playground at `silt.homeofed.com`.
**Stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
client-side simulation, scenes in `localStorage`, nothing server-owned.
Scaffolded from `templates/starter`
([ADR 0007](../../docs/adr/0007-reference-starter-app.md)). Spec:
`.scratch/sand-sim/spec.md` (v1) and `.scratch/silt-materials/spec.md`
(materials); tickets in `.scratch/silt/` and `.scratch/silt-materials/`.

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
                    render/  (letterboxFit, grid palette, the WebGL2 renderer +
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
types.ts      ElementDef / Archetype / Api / Lifetime / ReactionRow
elements.ts   pinned species ids + the roster (dirt, sand, water, lava, obsidian,
              wood, oil, fire, smoke, steam, acid, stone, sulphur, mud, seed,
              moss, vine) and v1Reactions — config plus one hook. Gas densities
              read backwards: `canDisplace` is `mine > theirs`, so the gas
              closest to zero rises highest. Reaction row order is load-bearing:
              a specific pair must precede any tag row covering it (acid + wood)
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
              (the "opinion field", ADR 0038) instead of re-rolling a coin;
              a blocked powder tries one random diagonal, not both (ADR 0039)
lifecycle.ts  applyReactions / applyLifetime — what happens to a cell after it
              has moved; neither moves anything
growth.ts     the roster's one `onTick`: moss and vine grow into water, up
              first, capped per cell by a branch count kept in `ra` and bounded
              overall by refusing any cell that already touches two plants
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
  writes it; `0` means "not seeded yet"), colour variant owns `rb`. New per-cell
  fields are parallel grids; the cell never widens past 4 bytes. There are
  **two exceptions, both conditional on the element declaring no `lifetime`**,
  and they cannot collide (one is static-only, the other liquid-only):
  - **The growth hook** (`growth.ts`): moss and vine hold their branch count in
    `ra`. Giving either a lifetime hands the byte back and uncaps growth.
    [ADR 0035](../../docs/adr/0035-silt-plant-growth-is-bounded-by-crowding.md) §3.
  - **The liquid opinion field** (`kernels.ts`): a liquid keeps its lateral
    direction, momentum and seeded marker in `ra` — bit 0, bits 1–3, bit 7.
    Unlike growth this one is *enforced*, not just documented: the scan passes
    `applyArchetype` a `raIsFree` flag, so a liquid that declares a lifetime
    degrades to the old coin flip instead of corrupting its countdown.
    [ADR 0038](../../docs/adr/0038-silt-liquids-keep-their-direction-in-ra.md).

  This entry and the comments at both sites are summaries of those ADRs, so a
  change to the rule belongs in the ADR first.
- **`Api` reaches a neighbour's `ra` nowhere; `MovementApi` does.** `raAt` /
  `setRaAt` exist for the liquid kernel's opinion contagion and are engine-only
  on purpose — an element hook scribbling on another cell's engine-owned byte is
  the failure mode the ownership rule exists to prevent.
- **A hook cannot keep its own cell awake.** `Api` has no `keepAwake` (it is on
  the engine-internal `MovementApi`), so a hook that must go on being offered a
  draw has to *write* — `growth.ts` writes `ra` every tick it has water to
  reach, because settled water writes nothing and the chunk would sleep under
  the plant.
- **`CHUNK_MARGIN` is fully spent.** The crowding check in `growth.ts` reads two
  cells out (the candidate is one away, its neighbours one past that), which is
  exactly the margin — a write wakes every chunk within two cells of it, so
  nothing is missed, but there is no slack left. A hook that needs a third cell
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
- `pnpm --filter silt run bench` — `bench/sim.bench.ts`, ms/tick for four named
  scenarios under native Node. A tool, not a gate: it is deliberately outside
  `pnpm test`, since a timing assertion in CI would only flake. It prints
  `scannedLastTick` beside every timing — a scenario that got faster because it
  stopped simulating is not a win, and the scanned count is what tells the two
  apart.
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3009, CT 3109.
- No database, no migrations, no `@hoe/db` — see
  [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
