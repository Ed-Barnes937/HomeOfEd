# 0008 — Apps without a database

- **Status:** Accepted
- **Date:** 2026-07-02
- **Revises:** [0001-foundation.md](0001-foundation.md) §4 (persistence seam
  "trivial apps adopt it too"), §6 ("one database per app"), and §13 (deep
  `/health` does a real `Store` round-trip) — for the no-DB case.
- **Supersedes:** [0006-db-less-apps.md](0006-db-less-apps.md) as the policy for
  new no-DB apps. 0006 established the pattern (layered skeleton, drop
  persistence) and `apps/boids` implements it; this ADR generalises it —
  stateless is the *baseline* (not a variant), the copy base is
  `templates/starter` (not `hub`), and the persistence seam is `void` (no
  `Store`) rather than a placeholder `InMemoryStatusStore`. 0006 stays as the
  record of boids' implementation; see [Reconciling boids](#reconciling-boids).
- **Related:** [0007-reference-starter-app.md](0007-reference-starter-app.md),
  [0005-unmanaged-fly-postgres.md](0005-unmanaged-fly-postgres.md).
- **How-to:** the procedure this ADR informs —
  [docs/how-to/adding-an-app.md](../how-to/adding-an-app.md) (the DB decision
  rule in §0, the opt-in DB steps in §2).

## Context

ADR 0001 assumed **every app has a Postgres database**: one database per app
(§6), a mandatory `Store`/`BlobStore` persistence seam that "trivial apps adopt
too" (§4), and a deep `/health` that does a real `Store` round-trip to Postgres
(§13).

Some apps are genuinely stateless — pure compute or tools, or apps whose only
"backend" is calling an external service. Forcing a database on them adds a
`fly postgres attach`, a schema + migrations + `release_command`, PGlite dev
machinery, and a DB-round-trip health check, all for no benefit.

**Auth is orthogonal to persistence.** Some routes will eventually require auth,
but auth will be **decentralised** — a central identity service issuing tokens
that apps verify through the already-frozen `ctx.auth.getUser()` seam (ADR 0001
§4), not each app running its own user table. So "this app needs auth" does
**not** imply "this app needs a database."

## Decision

**A stateless app is the baseline; a database is opt-in.** The reference starter
(ADR 0007) ships with no DB; adding one is an additive step.

### What a no-DB app keeps (unchanged from ADR 0001)

- The single-container shape: SPA + `createAppServer` (Fastify static + tRPC) on
  one Node process (§3).
- **Layered transport → domain.** Data still flows through **tRPC, never server
  functions** (§4). Handlers simply don't depend on a `Store` — they compute, or
  call an external service behind their own injected interface.
- **The injected seams stay, frozen and present:** `ctx.now()` (clock) and
  `ctx.auth.getUser()` (auth). Anonymous apps inject a null auth provider; an
  authed route plugs a central-auth provider into the *same* seam — no DB
  involved. `BlobStore` follows ADR 0001 §5's opt-in rule — omit it until the app
  actually stores a blob.
- **Dev simulator mode and `.iwft` still work** (real router, two transports);
  there is simply no persistence to fake.

### What a no-DB app drops

- The `@hoe/db` dependency, `drizzle.config.ts`, `src/server/schema.ts`,
  `migrations/`, `migrations.ts`, `store.ts`, `migrate.ts`, and `pnpm generate`.
- **PGlite** — dev/test-only anyway (§17); with no `Store` there is nothing to
  inject.
- The infra DB touchpoints: `fly postgres attach`, the `DATABASE_URL` secret,
  and the `release_command` migration step in `fly.toml`.
- The database service in `compose.yml` — the app is a single service.

### Health check

`/health` returns **process liveness only** — no `Store` round-trip. The CI
post-deploy smoke still fetches the SPA index + one static asset (proving the
artifact serves, not just that the process booted); only §13's DB-round-trip
half is dropped.

## Consequences

- Stateless apps are **cheaper** (no Postgres compute, no migrations, simpler
  health/smoke) and faster to stand up.
- **Two app shapes** to hold in mind (with-DB / no-DB) — mitigated by making
  no-DB the baseline and the database purely additive, so the difference is
  "did you run the DB section of the checklist," not two divergent templates.
- A stateless app that later grows state adds the DB layer deliberately (the
  additive checklist section + a normal migration) — there is no teardown to
  undo.

## Reconciling boids

`apps/boids` shipped ([ADR 0006](0006-db-less-apps.md)) before this ADR and the
`templates/starter` copy base existed, so it uses the older idiom:

- a `StatusStore` interface with a placeholder `InMemoryStatusStore` impl, rather
  than the `void` no-`Store` seam this ADR adopts;
- it was hand-built, not copied from `templates/starter`.

Both are valid no-DB apps and boids works — this is an **idiom divergence, not a
bug**. Boids is deliberately **left as-is** here (retrofitting a shipped app is
out of scope for the ADR that sets the going-forward rule). Aligning boids to the
`templates/starter` idiom, if wanted, is a separate mechanical task: drop
`StatusStore`/`InMemoryStatusStore`, switch its router to `createTRPC<void>()`,
and inject `store: undefined`. New no-DB apps follow `templates/starter` and the
[how-to](../how-to/adding-an-app.md), not boids.

## Non-goals / deferred

- **The decentralised auth design itself** — the identity service, token format,
  and which routes are gated — is a separate future ADR. This ADR records only
  that the `ctx.auth` seam is database-independent, so a no-DB app can still
  serve authed routes.
- **Retrofitting `apps/boids`** to the `void` idiom — see
  [Reconciling boids](#reconciling-boids) above; left as a possible follow-up.
