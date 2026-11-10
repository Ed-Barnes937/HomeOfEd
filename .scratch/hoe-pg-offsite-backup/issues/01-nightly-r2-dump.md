# 01 - nightly encrypted hoe-pg dump to Cloudflare R2

**Status:** ready-for-agent
**Type:** task
**Decision:** [ADR 0089](../../../docs/adr/0089-hoe-pg-offsite-backups-on-r2.md) - read it first
**Reported:** 2026-11-10, after the hoe-pg restore rehearsal passed
([../../hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md](../../hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md))

Fly's volume snapshots are proven restorable but live only 5 days inside Fly.
This ticket builds ADR 0089's off-Fly copy: a nightly `pg_dump` of every
`hoe-pg` database, `age`-encrypted, uploaded to R2 with 30-day retention.

## Agent-workable (one PR)

- **`.github/workflows/backup-hoe-pg.yml`:**
  - Triggers: `schedule` (nightly, off-peak UK) and `workflow_dispatch`.
  - Install `postgresql-client-17` from the PGDG apt repo, plus `age` and
    flyctl.
  - Open `fly proxy` to `hoe-pg`.
  - For each database (`family`, `fridge`, `hub`, `wotd`), run `pg_dump -Fc`
    as `hoe_backup`, pipe it through `age -r "$AGE_PUBLIC_KEY"`, and upload
    to R2 with the S3 API (`aws s3 cp --endpoint-url`, or another tool on the
    runner image) at `hoe-pg/<db>/<YYYY-MM-DD>.dump.age`.
  - Plaintext never touches disk or logs. Use `set -euo pipefail` so one
    failed database fails the run.
- **Secrets the workflow expects** (names only; Ed sets the values):
  `HOE_BACKUP_DATABASE_PASSWORD`, `AGE_PUBLIC_KEY`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. `FLY_API_TOKEN`
  already exists.
- **`scripts/go-live.sh --db`:** alongside ADR 0086's two statements, print
  `GRANT CONNECT ON DATABASE $APP TO hoe_backup;`, and remind the human to add
  the database to the workflow's list.
- **Runbook:** a new `docs/runbooks/hoe-pg-offsite-backup.md` holds the
  one-off setup below as copy-paste steps. Add a "restore from R2" section to
  `docs/runbooks/hoe-pg-restore-rehearsal.md`, done locally with no Fly infra:
  1. Download a dump.
  2. Decrypt it with `age -d -i <key>`.
  3. `pg_restore` it into a throwaway `docker run postgres:17`.
  4. Run the existing row-count query.
- Validate the workflow with `actionlint` (or the repo's equivalent), and test
  the shell steps against a local Postgres 17 container with a test age key
  and a local S3 stand-in where practical. Don't hit real R2 or `hoe-pg`.

## Human-gated (Ed, following the runbook the PR adds)

1. **Cloudflare:** turn on R2, create the bucket (Standard class), and add a
   lifecycle rule that deletes objects after 30 days. Create an API token with
   Object Read & Write scoped to that bucket only.
2. **age:** run `age-keygen -o hoe-pg-backup.key`. Store the private key in
   your password manager plus one offline copy, and never in the repo or CI.
   The public key (`age1...`) becomes `AGE_PUBLIC_KEY`.
3. **hoe-pg:** in `fly postgres connect -a hoe-pg`, run:
   `CREATE ROLE hoe_backup LOGIN PASSWORD '<generated>' IN ROLE pg_read_all_data;`
   `GRANT CONNECT ON DATABASE family, fridge, hub, wotd TO hoe_backup;`
4. **GitHub:** set the six repo secrets.
5. **First run:** trigger the workflow by hand. Confirm four objects in R2,
   then do the local restore from R2 once and record the result here.

## Done when

The workflow has run green on schedule at least once, R2 holds a dump per
database, and one has been decrypted and restored locally with row counts
matching.

## Comments
