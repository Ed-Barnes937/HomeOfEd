# apps/hub — scoped rules

The landing app at the apex `homeofed.com` and the **reference app** new apps
are copied from. Deliberately tiny: one page, one `trpc.health()` call that
reads a DB-sourced value.

## Layout

```
src/
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    schema.ts       Drizzle schema (app-owned)
    migrations.ts   hand-written SQL until T2.1's runner
    store.ts        HealthStore interface + DrizzleHealthStore over DbClient
    handlers/       Handler classes — business logic, AppContext only
    router.ts       tRPC router; exports AppRouter type
    simulator.ts    backendSimulator wiring: real router + PGlite Store
    health.test.ts  Vitest unit — handler with a hand-written Store fake
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
  testing/          IwftApp harness (in-browser backend) + page objects
  health.iwft.tsx   whole-frontend test via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3100 })
```

## Commands

- `pnpm dev --filter=hub` — simulator mode on port **3000** (real router +
  Node-side PGlite via Vite middleware; restart to pick up server changes).
- `pnpm test --filter=hub` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).

## Rules

- Server code changes go through TDD: unit test against a Store fake first,
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks
  to erasable TS syntax (ADR 0004) — it's loaded by native Node from
  `vite.config.ts`.
- Ports: dev 3000, CT 3100 — a copied app must pick fresh ones (root CLAUDE.md
  checklist).
- The prod entrypoint (`createAppServer` + real Postgres Store) lands in T3.1.
