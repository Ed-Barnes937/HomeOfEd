# 01 - hoe-pg backup/restore rehearsal

**Status:** done 2026-11-10 - rehearsal passed; off-Fly copy moved to ADR 0089 + hoe-pg-offsite-backup ticket 01
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

**2026-11-10 (agent): premise updated, audit done, runbook written; the rehearsal is Ed's.**

- The premise moved again. sprout left for its own `sprout-pg` with Tigris WAL
  backups (ADR 0072), so the sprout-cost ticket 04 gate above is void. `hoe-pg`
  now holds `family` (real household accounts and save copies) plus `fridge`,
  `hub`, `wotd`. ADR 0070 deferred this rehearsal to "the moment a
  non-household account exists"; ADR 0072 put it before the household pilot.
- Read-only audit: volume `vol_vdengnjkxxo8l834` (1GB, `lhr`), scheduled
  snapshots on, 5-day retention, five daily snapshots present (31-140 MiB
  stored, ~280 MiB total, inside Fly's 10GB free snapshot allowance).
- Runbook: [docs/runbooks/hoe-pg-restore-rehearsal.md](../../../docs/runbooks/hoe-pg-restore-rehearsal.md).
  Its one open unknown is whether a postgres-flex snapshot restore re-syncs the
  operator passwords; step 4 treats a refusal as the finding.

**Off-Fly copy: options for Ed's decision.** Snapshots share Fly's account,
region and provider with the data, so they do not cover losing the account, a
billing lapse, a mistaken `fly apps destroy hoe-pg`, or a bad migration noticed
after five days of snapshots have rolled past it. A nightly `pg_dump` per database (KBs to low
MBs compressed today) to storage outside Fly closes that.

| Option | Cost at this size | Independent of Fly? | Notes |
|---|---|---|---|
| Cloudflare R2 | $0 (10GB free, then $0.015/GB-mo, no egress fees) | Yes | Account already exists for DNS; bucket lifecycle rules handle retention. Recommended. |
| Backblaze B2 | $0 (10GB free, then ~$0.006/GB-mo) | Yes | Cheapest at scale; a new account and vendor. |
| Tigris via `fly storage create` | ~$0 at this size | No | Same Fly account and invoice; protects against volume loss only. |
| `--enable-backups` on hoe-pg | +$1.76/mo (needs 512MB) + Tigris storage | No | WAL-based point-in-time recovery, what sprout-pg has; complements an off-Fly dump rather than replacing it. |
| GitHub Actions artifacts | $0 | Yes | **Ruled out**: the repo is public and artifacts are downloadable by any signed-in GitHub user. |

Suggested shape, if R2: a scheduled GitHub Actions job (the org-scoped
`FLY_API_TOKEN` already exists) that runs `fly proxy` to `hoe-pg`, `pg_dump -Fc`
per database as a read-only role, encrypts each dump with `age` to a public key
whose private half Ed keeps offline (so neither the bucket nor CI logs can
expose children's data), and uploads to R2 with a 30-day lifecycle rule. The
dump restore then joins this rehearsal as a second exercise: `pg_restore` into
the same throwaway. Creating the bucket, the read-only role, the age key and the
CI secrets is human-gated; the workflow file and an ADR are agent work once the
storage is chosen.

**2026-11-10 (Ed): rehearsal run and passed; throwaway torn down.** Followed the
runbook end to end. The only discrepancy: the restored roles were still
superusers, because the newest snapshot predated ADR 0086's apply on
2026-11-09. Expected, and the runbook now says a real restore from such a
snapshot re-runs the least-privilege step before repointing apps. Ed also
upgraded `hoe-pg` from `postgres-flex:17.2` to `17.7` the same day; the runbook's
examples follow. This closes the precondition ADR 0070 deferred and ADR 0072
handed forward. Open: the off-Fly copy above, now decided as Cloudflare R2 in
ADR 0089 and ticketed at `.scratch/hoe-pg-offsite-backup/issues/01-nightly-r2-dump.md`.
