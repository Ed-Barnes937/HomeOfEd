# Runbook: rehearse a hoe-pg restore from a volume snapshot

Human-run, about an hour, a few pence. It proves that `hoe-pg`'s daily
snapshots restore into a working Postgres holding every database, and times how
long that takes. Nothing touches live `hoe-pg` or any app: the restore goes into
a throwaway cluster that nothing is attached to, and step 6 destroys it.

Why now: `hoe-pg` holds `family` (real household accounts and save copies)
alongside `fridge`, `hub` and `wotd`, on one 1GB volume in `lhr` with no WAL
backups ([ADR 0070](../adr/0070-family-service.md)). Fly's volume snapshots are
the only copy. [ADR 0072](../adr/0072-sprout-owns-its-postgres-and-triggers-are-scopes.md)
made this rehearsal a precondition for real household data, and ADR 0070
deferred it rather than closing it.

State on 2026-11-10 (read-only audit): volume `vol_vdengnjkxxo8l834`,
`Scheduled snapshots: true`, retention 5 days, five snapshots of 31-140 MiB
stored, image `flyio/postgres-flex:17.2` (upgraded to 17.7 the same day).

Throughout, the throwaway is called `hoe-pg-restore-test`. **Every mutating
command names that app. If a command you are about to run says `hoe-pg`
without `-restore-test`, stop.**

## 1. Pick the snapshot (read-only)

```bash
fly volumes list -a hoe-pg                         # the pg_data volume id
fly volumes snapshots list vol_vdengnjkxxo8l834    # newest is last
fly image show -a hoe-pg                           # REPOSITORY:TAG, e.g. flyio/postgres-flex:17.7
```

Take the newest snapshot id (`vs_...`). Write down the time you start: the
restore's wall-clock time is the number this rehearsal exists to produce.

## 2. Record live row counts (read-only)

The restored copy will be up to a day older than live, so counts may differ by
whatever was written since the snapshot. Capture live first so a difference is
explainable rather than alarming. Open one session per database (`\c` cannot
switch inside `fly postgres connect`):

```bash
fly postgres connect -a hoe-pg -d family   # then fridge, hub, wotd
```

Paste into each:

```sql
SELECT current_database() AS db, table_schema || '.' || table_name AS tbl, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::int AS row_count FROM information_schema.tables WHERE table_schema IN ('public', 'drizzle') AND table_type = 'BASE TABLE' ORDER BY 2;
```

Save the four outputs.

## 3. Restore into the throwaway

```bash
fly postgres create \
  --name hoe-pg-restore-test \
  --org personal \
  --region lhr \
  --snapshot-id <vs_...> \
  --image-ref flyio/postgres-flex:17.7 \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
```

- `--image-ref` is step 1's value. Its major version (17) must match the
  snapshot's, because a data directory only opens under the major version that
  wrote it; a newer minor is fine.
- `--volume-size` must be at least the source's 1GB.
- It prints a `postgres` password once. Keep it for this session only.

Do **not** run `fly postgres attach` against it: attaching would create roles
and set a `DATABASE_URL` secret on a real app.

When `fly status -a hoe-pg-restore-test` shows the machine `started` with its
checks passing, note the time. That gap is the restore time (the RTO
measurement).

## 4. Verify

```bash
fly postgres db list -a hoe-pg-restore-test
```

Expect `family`, `fridge`, `hub`, `wotd` with the same users as `hoe-pg`
(`hoe_family` and so on). Then repeat step 2's query against the restore:

```bash
fly postgres connect -a hoe-pg-restore-test -d family   # then fridge, hub, wotd
```

**Pass:** every table from step 2 exists, `drizzle.__drizzle_migrations` counts
match exactly, and every other count is equal to or slightly below live
(rows written since the snapshot). Then confirm the roles came through with
their least-privilege settings from ADR 0086:

```sql
SELECT rolname, rolsuper FROM pg_roles WHERE rolname LIKE 'hoe\_%' ORDER BY 1;
```

All four `rolsuper` should be `f`. A snapshot taken before ADR 0086 was
applied (2026-11-09) shows `t`: expected in a rehearsal, and in a real restore
it means re-running [the least-privilege runbook](hoe-pg-least-privilege.md)
step 2 before repointing any app.

**If `fly postgres connect` is refused for a password**, that is a finding
rather than a dead end: the snapshot carries `hoe-pg`'s role passwords and the
new cluster may not have re-synced its own operator credentials over them.
Record it in step 7, then try `fly ssh console -a hoe-pg-restore-test` and
`psql -h localhost -p 5433 -U postgres` with step 3's password. If that is also
refused, stop, destroy (step 6), and bring the output back for a conversation:
a real restore would hit the same wall, which is exactly what this rehearsal is
for.

## 5. What a real restore would add (read, do not run)

If `hoe-pg` were lost for real, steps 1, 3 and 4 are the same, with a permanent
name (for example `hoe-pg-2`) and `--initial-cluster-size 1` matching today.
Then every app gets its connection string pointed at the new host. The roles
and their passwords travel inside the snapshot, so only the host changes:

```bash
fly ssh console -a hoe-family -C 'printenv DATABASE_URL'
# same URL with hoe-pg.flycast -> hoe-pg-2.flycast:
fly secrets set -a hoe-family DATABASE_URL='postgres://hoe_family:...@hoe-pg-2.flycast:5432/family?sslmode=disable'
```

Repeat for `hoe-fridge`, `hoe-hub`, `hoe-wotd`, then check each `/health`
(hub's is on the apex). Data written after the snapshot is gone. For family
that means sign-ups and saves from that window; each app's `localStorage` is
still the source of truth for a child's work (ADR 0070), so boop re-syncs it.

`hoe-pg-2.flycast` needs a flycast address before it answers. Check with
`fly ips list -a hoe-pg-2`, and allocate one with
`fly ips allocate-v6 --private -a hoe-pg-2` if none is listed.

## 6. Tear down

```bash
fly apps destroy hoe-pg-restore-test
```

Read the name in the confirmation prompt before typing `y`. Then confirm the
real cluster is untouched:

```bash
fly status -a hoe-pg
for h in family.homeofed.com fridge.homeofed.com homeofed.com wotd.homeofed.com; do
  echo "$(curl -s "https://$h/health") $h"
done
```

## 7. Record the result

Add a dated comment to
`.scratch/hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md` with: the
snapshot id and its age, the restore time from step 3, pass or fail per
database, and anything that surprised you (especially step 4's password
behaviour). A pass closes the precondition in ADR 0070 and ADR 0072. The
off-Fly copy is [ADR 0089](../adr/0089-hoe-pg-offsite-backups-on-r2.md).
