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
constants.ts  GRID_WIDTH/HEIGHT (300×200, build-time), cell byte offsets, tick rate
types.ts      ElementDef / Archetype / Api / Lifetime / ReactionRow
elements.ts   pinned species ids + the registered roster (dirt, sand)
registry.ts   createRegistry — boot-time validation; refuses a bad roster
grid.ts       one ArrayBuffer, interleaved { species, ra, rb, clock } per cell
api.ts        CellApi — the chunk-relative (dx, dy) surface, one reused cursor
kernels.ts    applyArchetype — the only code that moves cells
sim.ts        the world: scan order, the clock guard, paint/tick
loop.ts       FixedTimestep — the tick rate, decoupled from any render loop
```

Rules that are easy to break by accident:

- **Archetypes own movement, hooks own transmutation.** An element that needs
  new *motion* is a bug against the archetype set, not a new hook.
- **No `Math.random()` under `src/sim`.** Randomness comes from the sim's `Rng`
  via `api.rand()` / `api.randInt()`; the determinism test guards this.
- **`Api` is `(dx, dy)`-relative only**, never absolute — chunked iteration
  (ticket 05) depends on it. Out of bounds reads the WALL sentinel.
- **Byte ownership**: `lifetime` owns `ra`, colour variant owns `rb`. New
  per-cell fields are parallel grids; the cell never widens past 4 bytes.
- **Species ids are pinned** — they go straight into localStorage scenes.

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
