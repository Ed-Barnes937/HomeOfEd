# 0089 - hoe-pg gets a nightly encrypted dump on Cloudflare R2

- **Status:** Accepted
- **Date:** 2026-11-10
- **Amends:** [ADR 0070](0070-family-service.md), which accepted `hoe-pg` with
  no backups beyond Fly's volume snapshots.
- **Related:** [ADR 0072](0072-sprout-owns-its-postgres-and-triggers-are-scopes.md)
  (handed forward "scheduled offsite dumps"), [ADR 0086](0086-hoe-pg-least-privilege.md),
  [restore rehearsal runbook](../runbooks/hoe-pg-restore-rehearsal.md)
- **Ticket:** [.scratch/hoe-pg-offsite-backup/issues/01-nightly-r2-dump.md](../../.scratch/hoe-pg-offsite-backup/issues/01-nightly-r2-dump.md)

## Context

`hoe-pg` holds `family` (real household accounts and save copies), `fridge`,
`hub` and `wotd` on one 1GB volume in `lhr`. On 2026-11-10 the restore
rehearsal proved that Fly's daily volume snapshots restore cleanly. Snapshots
are still kept for only 5 days, inside the same Fly account, billing
relationship and provider as the data. So they do not survive losing the Fly
account, a lapsed card, a mistaken `fly apps destroy hoe-pg`, or a bad
migration noticed after five days.

The options priced on 2026-11-10:
- **Cloudflare R2:** 10GB-month storage, 1M writes and 10M reads a month free,
  no egress fees, then $0.015/GB-month.
- **Backblaze B2:** 10GB free, a new vendor.
- **Tigris via Fly:** same account, so not off-Fly.
- **`--enable-backups`:** WAL point-in-time recovery, +$1.76/mo for the 512MB
  it requires, also on Fly.
- **GitHub Actions artifacts:** downloadable by any signed-in GitHub user,
  because the repo is public.

A nightly logical dump of every `hoe-pg` database is a few MB.

## Decision

1. **The off-Fly copy lives in a Cloudflare R2 bucket,** Standard storage
   class. The Cloudflare account already exists for DNS, and today's volume
   sits well inside the free tier, restores included.
2. **A scheduled GitHub Actions workflow takes it nightly.** It reaches `hoe-pg`
   through `fly proxy` with the existing org-scoped `FLY_API_TOKEN`, and runs
   `pg_dump -Fc` once per database as a dedicated `hoe_backup` role. That role
   is `pg_read_all_data` plus `CONNECT` on each database: it can read
   everything and write nothing, and no app role or superuser credential leaves
   Fly. GitHub emails the owner when a scheduled run fails, and that email is
   the alert.
3. **Every dump is encrypted before it leaves the runner,** with `age` to a
   public key held as a repo secret. The private key never touches CI or
   Cloudflare; Ed holds it offline. A leaked bucket token, a misconfigured
   bucket or a public workflow log therefore exposes ciphertext only.
4. **Retention is 30 days,** enforced by an R2 lifecycle rule rather than by
   the workflow, so CI's token needs object read/write on that one bucket and
   nothing else. Objects are keyed `hoe-pg/<database>/<YYYY-MM-DD>.dump.age`.
5. **A restore from R2 is rehearsed locally,** never on Fly: download, decrypt,
   and `pg_restore` into a throwaway `postgres:17` container, then compare row
   counts. That section joins the restore rehearsal runbook.

## Consequences

- Recovery point: up to a day from R2, the same as snapshots, but now
  independent of Fly. Point-in-time recovery stays out of scope until a
  household beyond Ed's needs it.
- The workflow must use a `pg_dump` whose major version is at least the
  server's (17). GitHub's runner image ships an older client, so the workflow
  installs 17 from the PostgreSQL apt repository.
- A new database in `hoe-pg` is not backed up until `hoe_backup` can connect to
  it. `go-live.sh --db` prints that grant alongside ADR 0086's statements, and
  the workflow's database list grows with it.
- Losing the `age` private key makes every dump unreadable. Ed keeps it in a
  password manager and in one offline copy.
- The CI token can overwrite or delete objects inside the 30-day window. This
  is accepted: R2 offers no write-only token, and the attacker would also need
  repo secrets.
- `sprout-pg` is out of scope. It already has Tigris WAL backups on Fly, and
  adding it to this workflow is a decision of its own.
