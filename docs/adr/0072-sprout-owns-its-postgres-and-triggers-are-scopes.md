# 0072 - sprout owns its Postgres, and the MPG triggers are scopes not events

- **Status:** Accepted
- **Date:** 2026-11-02
- **Revises:** [ADR 0005](0005-unmanaged-fly-postgres.md) - its third migration
  trigger and the one-way shape of its migration plan. ADR 0005's choice of
  unmanaged Postgres as the default, its one-database-per-app rule, and its
  "nothing in code changes" seam all stand unchanged.
- **Related:** [runbook](../runbooks/sprout-mpg-retirement.md),
  [ADR 0057](0057-family-service-legal-gate.md),
  [ADR 0008](0008-apps-without-a-database.md)

## Context

[ADR 0005](0005-unmanaged-fly-postgres.md) chose unmanaged Fly Postgres and
pre-committed three triggers for moving to Managed Postgres (MPG). The third
read: *"The child-safe LLM app (or anything with compliance weight) **goes
live**."* [Plan 0004](../plans/0004-sprout-migration-plan.md) D10 fired it on
2026-08-27 and provisioned an MPG Basic cluster for sprout.

The October 2026 invoice, read line by line, says that cluster was **64% of the
entire Fly bill**:

| Line | Net $/mo |
| --- | ---: |
| MPG cluster compute | 38.74 |
| MPG cluster storage | 0.84 |
| Machines, shared CPU + additional RAM (`lhr`) | 22.33 |
| Volumes, snapshots, certs, bandwidth (20 regions) | 0.68 |
| **Total** | **62.59** |

What that cluster actually held, measured 2026-11-02: **33 rows in 8.5 MB** -
1 user, 4 children, 4 conversations, 7 messages, 6 behavioural events. The
cluster metered 4.3 GB, so ~4.3 GB was MPG platform overhead (WAL retained for
PITR, base backups, logs), not data.

Three things were wrong with the trigger that put it there:

1. **It is an event, not a scope.** "Goes live" was written in July meaning
   *public launch*. It fired on a supervised household pilot behind an invite
   code ([ADR 0057](0057-family-service-legal-gate.md)), and as of 2026-11-02
   sprout is narrower still: an in-house demo with **one operator and no other
   users**. An event fires once and cannot un-fire; a scope can be re-tested
   whenever the facts change.
2. **The trigger list carries no cost term.** ADR 0005's context states the 10x
   premium and chooses unmanaged *because of it*, then drops the number from
   the triggers, so firing one reads as free. D10's table has no cost column
   either.
3. **MPG has no small tier.** Basic at $38/mo is the floor; Starter is $72, a
   middle tier filling the gap to Launch ($282). "Provision MPG" is never a
   small commitment, so the trigger cannot be cheap to fire.

ADR 0005's *other* two triggers are sound. "An app holds real user data that
can't be regenerated from migrations" will be genuinely true of sprout the day
a real household uses it. MPG was the wrong **size** of answer at this scope,
not the wrong **kind**.

## Decision

**1. sprout's database is its own unmanaged cluster, `sprout-pg`.** Single
`shared-cpu-1x` node at 512MB, 1GB volume, in `lhr`, created with
`--enable-backups` (Tigris WAL-based backups). ~$4.48/mo. Not MPG, and not a
logical database inside the shared `hoe-pg` cluster.

A separate cluster rather than a database in `hoe-pg` costs ~$1.91/mo more and
buys an independent failure domain, restore granularity and upgrade schedule
for the one app slated to hold family data. At that price the isolation is
worth more than the saving. ADR 0005's one-database-per-app rule is satisfied
either way; this goes further.

**2. The 512MB is load-bearing.** Fly refuses `--enable-backups` below 512MB.
The extra 256MB costs $1.76/mo in `lhr` and is the price of having backups at
all, which is what makes an unmanaged cluster defensible for this app.

**3. ADR 0005's third trigger is restated as a scope.** It now reads:

> **An app serves production data belonging to people other than the operator.**
> Re-test this whenever the user scope changes, in either direction.

Replacing "goes live" with a scope means an in-house demo does not fire it, a
household pilot does, and a demo that *stops* being a demo fires it again
without anyone needing to remember a launch date.

**4. Every trigger carries its cost.** Any document firing an ADR 0005 trigger
must state the then-current MPG floor ($38/mo at Basic as of 2026-11-02) in the
decision itself. A trigger with no price attached is not a decision.

**5. The migration plan is two-way.** ADR 0005's plan only went unmanaged → MPG
("delete after a comfortable soak"). Coming back is now an expected move when a
scope narrows, and the runbook documents it.

## Consequences

- **We own sprout's ops again**: no HA, no PITR, no vendor failover. Mitigated,
  not removed, by Tigris WAL backups, which plain ADR 0005 unmanaged clusters
  (`hoe-pg`) still lack.
- **The `hoe-pg` restore-rehearsal gate no longer blocks sprout.** It existed to
  stop children's data landing on an unrehearsed node. sprout holds no such data
  today and is not on `hoe-pg`. The gate returns as a precondition before a real
  household pilot starts, alongside scheduled offsite dumps.
- **The 33 demo rows were discarded.** Schema returned from committed Drizzle
  migrations; re-registration was required. Acceptable precisely because the
  scope test above says this is a demo. It would not be acceptable one scope up.
- **Unmanaged Fly Postgres remains deprecated in intent** (no announced
  timeline). The Tigris dumps are an exit hatch as well as a backup: a
  `pg_dump` restores into MPG, Neon or Hetzner.
- **sprout stops being the estate's exception.** Its web and pipeline machines
  now scale to zero like every other app; the first request after idle pays a
  cold start. Reversed by restoring `min_machines_running = 1` when a pilot
  starts.
- **Bill: $62.59/mo → ~$16.11/mo** once the demo footprint lands.
