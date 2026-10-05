# 01 - Establish the true bill: the MPG cluster and what else the baseline missed

**Status:** ready-for-human
**Type:** research
**Map:** ../map.md
**Reported:** 2026-10-05, Ed ("my bill last month was over $50")

## Question

The [Fly cost baseline](../../account-infra-discovery/issues/02-fly-cost-baseline.md)
said ~$13.30/mo. The actual invoice is >$50. The known cause is that the
baseline inventoried Fly **apps** and an MPG cluster is not an app - but
"known cause" is a hypothesis until the invoice is read line by line. Nothing
downstream (03's ADR, 04's migration) should be sized off an estimate when the
ground truth is one dashboard away.

**Read-only `fly` commands only; never create or mutate infra.**

## What to establish

**The MPG cluster:**

- `fly mpg list` - does it exist, what is it named, what region.
- Its **plan tier** (Basic $38/mo is the floor; Starter $72, Launch $282) and
  its **provisioned storage GB** at $0.28/GB/mo. A Basic cluster with 20GB
  provisioned is $43.60, not $38 - the storage line is not rounding error.
- Whether HA / replicas are on, and whether that is chargeable here.

**The invoice itself (dashboard - `fly` has no billing read command):**

- Last month's actual invoice, line by line. Reconcile against the baseline's
  resource table. Name every line the baseline did not predict, not just MPG.
- Any credits or discounts in play (the baseline flagged these as unknowable
  from the CLI).

**The rest of the estate, re-checked:**

- Confirm the three always-on app machines are still always-on and still
  512MB (`hoe-hub`, `hoe-sprout` web, `hoe-sprout-pipeline`).
- Confirm `hoe-sprout`'s `worker` machine count - `fly.toml` sets
  `min_machines_running` for the `web` group only; the worker's count was set
  out of band via `fly scale count worker=1` and never re-verified.
- Confirm the legacy apps from the baseline are still running:
  `child-safe-llm-db`, `malleable-pls-db`, `malleable-pls-server` (ticket 05).
- `hoe-pg`'s current volume size and free space - ticket 04 adds a database to
  it, and a 1GB volume may need growing first.

**One thing to settle explicitly:** which database is sprout actually pointed
at right now? `apps/sprout/fly.toml` and `go-live.md` both mandate MPG, but
the [restore rehearsal ticket](../../hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md)
describes `hoe-pg` as "holding the kids' sprout chat data". Both cannot be
true. Check `DATABASE_URL`'s host on `hoe-sprout` (a `*.flympg.net` host means
MPG; `hoe-pg.flycast` means the shared cluster). **If sprout is on `hoe-pg`
after all, this whole effort changes shape and the MPG cluster is simply an
unused $38/mo to delete** - and the restore rehearsal is more urgent, not less.

## Deliverable

The corrected cost table, appended here as the Answer, and echoed to the map's
money table. Correct the
[Fly cost baseline](../../account-infra-discovery/issues/02-fly-cost-baseline.md)
Answer if anything beyond MPG proves wrong there too.

## Comments
