# 01 - hoe-pg backup/restore rehearsal

**Status:** ready-for-agent
**Type:** task
**Reported:** 2026-09-10, spawned from the account-infra decision sitting
(`.scratch/account-infra-discovery/issues/05-decision-sitting.md`, decision 6)

The hosting landscape survey flagged the estate's real ops gap: `hoe-pg` is a
single 256MB postgres-flex node holding the kids' sprout chat data, and its
restore has **never been rehearsed**. Untested backups are hope, not backups.

Real-world cost (answered for Ed in the sitting): pennies - Fly bills per
second, so a throwaway restore target for an afternoon is a few pence,
deleted after; ~1-2 hours of Ed's time; $0 ongoing unless offsite dumps are
added later.

## Scope

**Agent-workable (read-only, do first):**

- Verify what backups actually exist: `fly volumes list` / snapshot listing
  for the hoe-pg volume, retention window, and whether snapshots are actually
  being taken. Read-only `fly` commands only.
- Draft the rehearsal runbook: restore a snapshot into a **throwaway**
  postgres-flex app, connect, verify sprout's tables and row counts, then
  destroy the throwaway. Include the offsite-dump option (scheduled
  `pg_dump` to object storage, ~$0.02/GB/mo class) as a follow-up decision,
  not part of the rehearsal.

**Human-gated (Ed executes):** everything that creates or mutates infra -
the throwaway cluster, the restore itself, the teardown. The runbook is the
deliverable; the rehearsal is Ed following it.

## Comments

**2026-10-05 (agent): this rehearsal is now a hard gate on a migration, and its
premise needs checking first.**

[.scratch/sprout-cost/](../../sprout-cost/map.md) proposes moving sprout off its
$38/mo Managed Postgres cluster into a `sprout` database in `hoe-pg`
([ticket 04](../../sprout-cost/issues/04-migrate-sprout-mpg-to-hoe-pg.md)).
That migration is **blocked on this rehearsal passing** - not being drafted,
being run. Moving children's chat data onto a node whose restore has never been
exercised, to save $38/mo, is a worse trade than paying the $38. This ticket's
own line is the reason: untested backups are hope, not backups.

**Premise to re-check before starting.** This ticket describes `hoe-pg` as
"holding the kids' sprout chat data". That is probably wrong today:
`apps/sprout/fly.toml` and `apps/sprout/docs/go-live.md` both mandate MPG for
sprout, explicitly *not* `hoe-pg`. If sprout is genuinely on MPG, then `hoe-pg`
currently holds only hub / fridge / wotd data - all regenerable from migrations
- which lowers today's urgency but does not lower the bar, because ticket 04
intends to put the sprout data there. Settle which cluster sprout actually uses
first ([sprout-cost ticket 01](../../sprout-cost/issues/01-true-bill-inventory.md)
checks `DATABASE_URL`'s host); the rehearsal runbook is worth writing either way.

**One addition to scope:** the offsite-dump option this ticket defers as "a
follow-up decision" becomes a **precondition** of ticket 04. Once sprout's data
lives in `hoe-pg`, a single Fly volume in one region is the only copy. Cadence,
retention and the accepted RPO/RTO are to be settled in ticket 03's ADR.
