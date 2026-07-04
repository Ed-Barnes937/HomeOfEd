# apps/hub — scoped rules

The launcher/landing app at the apex `homeofed.com`. One page: the wordmark and
the app rail (nav, links). The `trpc.health()` DB round-trip stays wired
server-side (router → handler → Store) as the worked example, but the current
page no longer surfaces it. New apps are **not** copied from here — the copy base
is `templates/starter` ([ADR 0007](../../docs/adr/0007-reference-starter-app.md)).
hub keeps the DB layer as the worked example of a database-backed app; the
stateless baseline lives in the starter
([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)).

## Layout

```
src/
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    schema.ts       Drizzle schema (app-owned)
    migrations/     drizzle-kit output (`pnpm generate`) — SQL + meta/, committed
    migrations.ts   Vite ?raw glob loader → statement list (browser/vitest)
    store.ts        HealthStore interface + DrizzleHealthStore over DbClient
    handlers/       Handler classes — business logic, AppContext only
    router.ts       tRPC router; exports AppRouter type
    simulator.ts    backendSimulator wiring: real router + PGlite Store
    main.ts         prod entrypoint: createAppServer + real Postgres Store
    migrate.ts      release_command: run-once migrations (migratePostgres)
    health.test.ts  Vitest unit — handler with a hand-written Store fake
    store.test.ts   Vitest — DrizzleHealthStore over PGlite + the generated migrations
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
  testing/          IwftApp harness (in-browser backend) + iwft fixture + page objects
  health.iwft.tsx   whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
drizzle.config.ts   drizzle-kit: schema → src/server/migrations
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3100 })
```

## Commands

- `pnpm dev --filter=hub` — simulator mode on port **3000** (real router +
  Node-side PGlite via Vite middleware; restart to pick up server changes).
- `pnpm test --filter=hub` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- `pnpm generate --filter=hub` — drizzle-kit migration from schema changes
  (`--custom` for hand-written SQL); commit the whole output folder.
- Prod (container/release): `pnpm build` then `pnpm start` (needs
  `DATABASE_URL`, see `.env.example`; default port 8080); `pnpm migrate` is the
  deploy-time release_command.

## Rules

- Server code changes go through TDD: unit test against a Store fake first,
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks
  to erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts`/`migrate.ts` run
  under native Node.
- Migrations are loaded two ways on purpose: `migrations.ts` (Vite `?raw` glob)
  for the .iwft browser bundle and vitest; `@hoe/db/node`'s fs loader for
  native-Node contexts (dev simulator, prod). Schema changes touch only
  `schema.ts` + `pnpm generate`.
- Ports: dev 3000, CT 3100 — a copied app must pick fresh ones (root CLAUDE.md
  checklist).
