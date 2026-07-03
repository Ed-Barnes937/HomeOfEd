# 0006 — DB-less apps keep the layered skeleton, drop persistence

- **Status:** Superseded (as policy) by
  [0008-apps-without-a-database.md](0008-apps-without-a-database.md). This ADR
  remains the record of `apps/boids`' implementation; new no-DB apps follow 0008
  (stateless is the baseline, `templates/starter` is the copy base, `void`
  persistence seam). See [0008 → Reconciling boids](0008-apps-without-a-database.md#reconciling-boids).
- **Date:** 2026-07-02
- **Related:** [ADR 0001](0001-foundation.md) §4 (layered backend + DI),
  [0002-boids-implementation-plan.md](../plans/0002-boids-implementation-plan.md)

## Context

`apps/boids` is a client-side canvas simulation with settings persisted in
`localStorage`. It has no server-owned data: nothing to migrate, nothing to
seed, nothing a `Store` would query. Copying `hub` verbatim (ADR 0001 §11)
would still drag in Drizzle, `@hoe/db`, a generated migration, and a PGlite
boot in every test run for data that doesn't exist.

ADR 0001 §4 makes the layered backend + DI a **hard convention**, not a
Postgres requirement — "trivial apps adopt it too, so any app can use
standalone-run and `.iwft` tests." The question this ADR answers: what does
that convention look like when an app has no database at all.

## Decision

- **Keep the layered skeleton** (`transport (tRPC) → domain (handler classes)
  → Store interface`) even with no database. It costs nothing extra to keep
  and preserves the "same handlers run in prod and in the simulator" property
  and the standard app shape.
- **Store = `StatusStore`**, an interface with a single `InMemoryStatusStore`
  implementation (`ping()` returning a static status string). This one impl
  is used in **all three** contexts — prod, dev simulator, and `.iwft` — so
  `simulator.ts` and `main.ts` differ only in transport, not in persistence.
  There is no fake-vs-real split to maintain because there is no real store.
- **`/health` means "process up + serving"**, not a database round-trip. The
  injected `healthCheck` closure still exists (`createAppServer`'s frozen
  contract), it just closes over `store.ping()` against memory. The CI smoke
  (health + SPA index + hashed asset) still proves what matters for a DB-less
  app: the artifact serves.
- **No migrations, no `@hoe/db`, no `drizzle-orm`/`drizzle-kit`.** The three
  entrypoints (`main.ts`, `simulator.ts`, `testing/IwftApp.tsx`) are rewritten,
  not trimmed, since hub's versions import the now-deleted DB modules
  (`freshTestDb`, `loadMigrationsFromDir`, `createDbClient`/`loadDbEnv`,
  `hubSchema`, `migrations`, `DrizzleHealthStore`). `.iwft` gets faster as a
  side effect — no PGlite WASM boot.
- **The frontend makes no tRPC calls.** The router exists to satisfy
  `createAppServer` and keep the skeleton conventional; it's a ready seam if a
  backend feature ever lands, not active plumbing today.
- **`hub` remains the DB-backed reference app** for the "adding an app"
  checklist (root `CLAUDE.md`). This ADR documents a *variant* new apps opt
  into when they genuinely have no server-owned data — it does not change the
  default copy target or the default assumption that a new app has a
  database.

## Consequences

- Boids' `apps/boids/src/server/` is a small skeleton (`store.ts`,
  `handlers/healthHandler.ts`, `router.ts`, `simulator.ts`, `main.ts`,
  `health.test.ts`) with no `schema.ts`, `migrations/`, `migrate.ts`,
  `drizzle.config.ts`, or `store.test.ts` (that test exercises a Drizzle store
  over PGlite + migrations, which don't exist here).
- `fly.toml` for a DB-less app has no `release_command` and no `DATABASE_URL`
  secret; `compose.yml` needs no accompanying database service.
- **Reintroducing a database later** (a future boids feature that needs
  server state) means re-copying `hub`'s DB touchpoints — `schema.ts`,
  `migrations/`, `drizzle.config.ts`, the `DrizzleXStore` pattern, the
  `migrate.ts` release command — and following runbook G4.1's Postgres
  attach step. It's a bounded, mechanical amount of work, not a rewrite: the
  `StatusStore` interface is replaced by a real interface, and the three
  entrypoints swap `InMemoryStatusStore` for the Drizzle-backed store the same
  way `hub` does today.
