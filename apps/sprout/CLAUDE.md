# apps/sprout

The child-safe LLM web app, being migrated into the hub per
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).

**Current phase: P1 done (database).** The DB layer is in: one merged
`schema.ts` (9 app + 4 Better Auth tables), `@hoe/db` driver, a first generated
migration, and `SproutStore`/`DrizzleSproutStore`. The Store generic is threaded
through router/simulator/main/`IwftApp`. The greeting demo is retained as a
verify signal (its handler carries the `SproutStore` generic but ignores it);
it is replaced with the real app in later phases.

Landing here in a later phase: Better Auth (P2), the tRPC backend (P3), the SPA
frontend (P4), SSE streaming (P5), and SCSS styling (P7) are not built yet. The
`SproutStore` interface holds a P1 slice of query methods; **P3 extends it per
handler**.

## Layout

```
src/
  server/
    schema.ts       all 13 tables (app + Better Auth); exports sproutSchema + SproutSchema
    store.ts        SproutStore interface + DrizzleSproutStore over DbClient<SproutSchema>
    migrations/     committed drizzle-kit output (*.sql + meta/_journal.json)
    migrations.ts   Vite ?raw glob loader (browser/vitest)
    migrate.ts      release_command entrypoint (migratePostgres)
    handlers/       Handler classes — business logic, AppContext<SproutStore>
    router.ts       tRPC router; createTRPC<SproutStore>(); exports AppRouter
    simulator.ts    dev/.iwft backend wiring: real router + Node-side PGlite Store
    main.ts         prod entrypoint: createAppServer + deep /health (store.ping())
    store.test.ts   Vitest — DrizzleSproutStore over PGlite (incl. §6.7 feature checks)
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
  testing/          IwftApp harness (in-browser PGlite backend) + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend test via the in-browser backend
drizzle.config.ts   drizzle-kit config (schema -> migrations)
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3105 })
```

Note: the source schema has **no true `jsonb` columns** — `flags.topics` is
`text` holding a JSON string and presets are plain `integer` sliders; ported
faithfully. FKs `children.parentId`/`devices.parentId` -> `user.id` are
`onDelete: cascade` for clean account-erasure semantics.

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
