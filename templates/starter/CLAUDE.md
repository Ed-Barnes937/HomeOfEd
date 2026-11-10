# templates/starter — the copy base for new apps

The minimal reference app new apps are copied from
([ADR 0007](../../docs/adr/0007-reference-starter-app.md)). It is **stateless** —
no database ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) — and it
is **never deployed**: it lives in `templates/` so `turbo` lints / typechecks /
tests / builds it every PR (that is what stops it rotting), but no CI deploy job
targets it.

One route rendering `trpc.greeting()` — a value computed by the full layered path
with no persistence:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

`GreetingHandler` reads the **auth seam** (which stays frozen and is
DB-independent) and otherwise just computes.

## Layout

```
src/
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    handlers/       Handler classes — business logic, AppContext only, no Store
    router.ts       tRPC router; createTRPC<void>() (no Store); exports AppRouter
    simulator.ts    backendSimulator wiring: real router, no Store, no PGlite
    main.ts         prod entrypoint: createAppServer + shallow /health + the estate gate
    main.test.ts    Vitest - main.ts on a real port, gate on and off
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
  testing/          IwftApp harness (in-browser backend) + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3101 })
```

No `schema.ts`, `store.ts`, `migrations/`, `migrate.ts`, or `drizzle.config.ts`,
and no `@hoe/db` dependency — a stateless app has none of these. Add them (copy
from `apps/hub`) only if the app gains a database.

## Commands

- `pnpm dev --filter=starter` — simulator mode on port **3001** (real router, no
  persistence; restart to pick up server changes).
- `pnpm test --filter=starter` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams first,
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3001, CT 3101 — a copied app must pick fresh ones (root CLAUDE.md
  checklist).
- **Gated by default** ([ADR 0093](../../docs/adr/0093-estate-gate.md)): `main.ts`
  gates document requests via `familyDocumentGateFromEnv` exactly when
  `FAMILY_ACCOUNT_URL` is set. The template's `fly.toml` sets it; a copied app
  keeps that line only once the production verifying key is committed (a test
  in `@hoe/accounts` enforces this). It also joins `ESTATE_APPS` and needs its
  compose lines; see
  [docs/how-to/adding-an-app.md §1a](../../docs/how-to/adding-an-app.md#1a-the-estate-gate-every-app).
- **Adding a database?** Follow the step-by-step in
  [docs/how-to/adding-an-app.md §2](../../docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only)
  — copy the DB layer from `apps/hub`, swap the `void` Store type params for your
  Store interface, inject it per transport, deepen `/health`, and add the
  `release_command`. Rationale: [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
