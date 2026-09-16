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
