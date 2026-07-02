# 0005 — Unmanaged Fly Postgres now; migrate to Managed Postgres when durability matters

- **Status:** Accepted
- **Date:** 2026-07-02
- **Revises:** [0001-foundation.md](0001-foundation.md) §6 ("Fly Managed
  Postgres") and G4.1 of the
  [go-live runbook](../runbooks/phase-4-go-live.md).

## Context

Fly has two Postgres products, and ADR 0001 §6 picked the wrong cost tier for
this stage:

- **Managed Postgres (MPG)** — Fly's actual managed service (`fly mpg`):
  they run backups, replication, upgrades, monitoring. Fixed plan pricing with
  a **floor of ~$38/month** (Basic) plus $0.28/GB provisioned storage.
- **Unmanaged Fly Postgres** (`fly postgres`) — the legacy product: ordinary
  Fly Machines running a Postgres image, billed as plain compute. A
  single-node development configuration costs a few dollars a month. Fly
  managed nothing here even when it was marketed as managed (docs corrected
  Dec 2024): backups, failover, and upgrades are the operator's problem.

At go-live time the hub serves a landing page whose only state is a
migration-seeded health row; every future app starts equally disposable, and
all schema+seed state is reproducible from committed migrations. Paying a 10×
premium for backups of data we can regenerate from git is not justified yet —
and the operator's existing Fly databases are already the unmanaged product,
so this is also the setup they know how to run.

## Decision

- **Production database = unmanaged Fly Postgres**: one cluster (`hoe-pg`,
  region `lhr`, smallest single-node development configuration), still **one
  database per app** (ADR 0001 §6's isolation rule is unchanged).
- Apps are wired with `fly postgres attach <cluster> --app <flyapp>
  --database-name <name>` — this creates the database + a scoped user and sets
  the app's `DATABASE_URL` secret in one human-run step.
- **Nothing in code changes.** Apps only ever see `DATABASE_URL`; the driver,
  migrations, CI, and Docker stack are identical against either product. The
  connection host is `hoe-pg.flycast` (Fly private networking) instead of
  `*.flympg.net`.

## Consequences

- **We own the ops**: no automated backups, no point-in-time recovery, no
  failover (single node), upgrades are manual. Accepted while all data is
  reproducible from migrations.
- The legacy product receives minimal new investment from Fly; MPG is where
  their effort goes. This is a deliberately temporary position — see the
  migration plan below.
- Cost drops from ~$38/month to a few dollars of compute.

## Migration plan → Managed Postgres

**Triggers — migrate when any of these becomes true:**

- An app holds real user data that can't be regenerated from migrations.
- Point-in-time recovery or replication is actually needed.
- The child-safe LLM app (or anything with compliance weight) goes live.

**Steps** (human-run, same infra-gating as Phase 4):

1. `fly mpg create --name hoe-pg-managed --region lhr` and create each app's
   database in it (`fly mpg connect` → `CREATE DATABASE <name>;`).
2. Per app, copy data across:
   `fly proxy 16380:5432 --app hoe-pg` in one terminal, then
   `pg_dump 'postgres://…@localhost:16380/<name>' | psql '<mpg-url>/<name>'`.
   Drizzle's migration ledger (`drizzle.__drizzle_migrations`) travels with
   the dump, so the journal-tracked `release_command` stays a no-op after
   cutover.
3. `fly secrets set --app <flyapp> DATABASE_URL='<mpg-url>/<name>'` — the
   secret change restarts the machines onto the new database.
4. Verify each app's deep `/health` (it does a real Store round-trip).
5. Scale the old cluster to zero, delete after a comfortable soak
   (`fly apps destroy hoe-pg`).

Apps can migrate one at a time (the secret is per app), so the first app that
trips a trigger moves alone and the rest follow when they care.
