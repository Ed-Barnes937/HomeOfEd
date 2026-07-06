# apps/sprout

The child-safe LLM web app, being migrated into the hub per
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).

**Current phase: P0 (scaffold).** This is still the stateless starter baseline
copied from `templates/starter` ([ADR 0007](../../docs/adr/0007-reference-starter-app.md),
[ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) with only its identity
renamed. The greeting demo (handler + router + query + page + `.iwft`) is kept
as the P0 verify signal; it is replaced with the real app in later phases.

Landing here in a later phase: the plan adds a database (P1), Better Auth (P2),
the tRPC backend (P3), the SPA frontend (P4), SSE streaming (P5), and SCSS
styling (P7). None of that exists yet.

## Layout (P0)

```
src/
  server/
    handlers/       Handler classes — business logic, AppContext only, no Store
    router.ts       tRPC router; createTRPC<void>() (no Store); exports AppRouter
    simulator.ts    dev/.iwft backend wiring: real router, no Store, no PGlite
    main.ts         prod entrypoint: createAppServer + shallow /health
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
  testing/          IwftApp harness (in-browser backend) + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend test via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3105 })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, `drizzle.config.ts`, or
`@hoe/db` dependency yet — the Store is still `void`. P1 adds the DB layer and
swaps the `void` Store type params for `SproutStore` (see the plan §11 P1 and
[docs/how-to/adding-an-app.md §2](../../docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only)).

## Commands

- `pnpm dev --filter=sprout` — simulator mode on port **3004** (real router, no
  persistence; restart to pick up server changes).
- `pnpm test --filter=sprout` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams first,
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3004, CT 3105.
