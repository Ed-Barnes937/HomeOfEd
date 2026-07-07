# 0014 — First worker process: `[processes] web + worker` for scheduled work

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [0004-sprout-migration-plan.md](../plans/0004-sprout-migration-plan.md)
  §9.2 (D8), [0001-foundation.md](0001-foundation.md) §3 (background/scheduled work
  = multi-process, same Fly app)

## Context

sprout is the first app in the estate with **scheduled background work**:
data-retention sweeps. Conversations and behavioural-events must be pruned after a
retention window (a data-minimisation obligation for a product used by children,
tied to the launch-readiness gate). This runs on a timer, independent of any HTTP
request, and must not depend on a request arriving to fire.

Every existing app is a single web process. The options for periodic work were:
an external scheduler (Fly cron / a third-party), a self-scheduling loop inside the
web process, or a **separate process in the same Fly app**. ADR 0001 §3 already
answers this in principle — "background/scheduled work is a multi-process concern,
kept in the same Fly app" — but no app had exercised it, so the concrete pattern
was unproven.

## Decision

Run retention as a **`worker` process alongside `web` in the same Fly app**, from
the **same image** (D8).

**Fly process groups.** `apps/sprout/fly.toml` declares:

```
[processes]
  web    = 'node src/server/main.ts'
  worker = 'node src/server/worker.ts'
```

Only `web` sits behind `[http_service]` (`processes = ['web']`) and the `/health`
check; `worker` has no HTTP surface and is never health-checked. Fly runs one
machine per group from the one image; the process group overrides the Dockerfile
`CMD` per machine. `min_machines_running` is an `http_service` setting and governs
`web` only — the worker's machine count is set out of band at go-live
(`fly scale count worker=1`), which is recorded as a human step in the fly.toml and
the go-live doc.

**Scheduling is a plain timer, not a scheduler.** `worker.ts` is a `setInterval`
loop (`startRetentionWorker`) around a pure `runRetentionSweep(deps)` core that
takes the same `Store` interface the handlers use. Windows are env-configured
(`RETENTION_DAYS`, `BEHAVIOURAL_EVENT_RETENTION_DAYS`, `WORKER_INTERVAL_MS`;
defaults 30d / 30d / hourly). There is **no bespoke scheduler, no job queue, no
cron dependency** — a timer in a min-1 process is enough for a daily-granularity
sweep, and it keeps the mechanism inside the app's own DI seams.

**Testability.** `runRetentionSweep` is unit-tested against a fake `Store`
(deterministic `now()` + seeded rows in / expected deletes out); the timer wrapper
is not the thing under test. An entrypoint guard
(`if (process.argv[1] === fileURLToPath(import.meta.url))`) means importing the
module for tests does not start the loop.

## Consequences

- Scheduled work runs in a **dedicated always-on process**, decoupled from request
  traffic — the sweep fires whether or not anyone is using the app, and a slow
  sweep never blocks a web request.
- **One image, one deploy, one release_command.** The migration that the web
  process needs is the migration the worker needs; there is nothing extra to build
  or deploy for the worker beyond the process-group line and the go-live scale step.
- The pattern is now proven and reusable: the next app that needs periodic work
  copies the `[processes]` split and a `worker.ts` with a pure sweep core. If a
  future need outgrows a timer (sub-minute precision, distributed locking,
  retries), that is a new decision — this ADR deliberately does not build for it.
- The one non-obvious operational footgun (`min_machines_running` not covering the
  worker) is documented at both the config and the go-live-handoff level so the
  worker is not silently left at zero machines.
