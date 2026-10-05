# 04 - Migrate sprout: MPG -> a `sprout` database in `hoe-pg`

**Status:** ready-for-human
**Type:** task
**Blocked by:** 01, 02, 03, and
`../../hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md` **passing**
**Map:** ../map.md

## The gate, stated plainly

**Do not start this until the restore rehearsal has actually been run and
passed.** Not drafted - run, by Ed, with a real snapshot restored into a
throwaway cluster and row counts verified.

Today sprout's data sits on a cluster with vendor-run backups, HA and PITR.
`hoe-pg` is a single 256MB node whose backups **have never been restored by
anyone**. Moving children's chat histories, accounts and safeguarding flags
onto an unrehearsed node to save $38/mo is a worse trade than paying the $38.
The rehearsal is what converts "hoe-pg has snapshots" into "hoe-pg has
backups".

Second precondition, from ticket 03's ADR: **scheduled offsite dumps**. The
restore rehearsal ticket lists these as "a follow-up decision, not part of the
rehearsal" - correct for `hoe-pg` as it stands today, holding regenerable hub /
fridge / wotd data. The moment sprout's data lands there, a single Fly volume
in one region is the only copy that exists. A scheduled `pg_dump` to object
storage (~$0.02/GB/mo class) stops being optional. Decide its cadence and
retention in the ADR, implement before cutover, not after.

**Also conditional on ticket 02.** If the pilot is dormant (option C), the
right move is dump-and-delete, not migrate - do not do this work to preserve a
database nobody is using.

## The migration itself

ADR 0005 already documents this path, in the other direction; run it in
reverse. All steps are **human-gated** (CLAUDE.md) - an agent must not run them.

1. Create the `sprout` database and a scoped user in `hoe-pg`. Check the
   volume has headroom first (ticket 01 reports its size and free space); grow
   it before the dump lands, not during.
2. Quiesce writes: scale `hoe-sprout` web and worker to zero so nothing is
   mutating mid-dump. This is a real outage window - the pilot is two children,
   so pick a time and tell them.
3. `pg_dump` from MPG, `psql` into `hoe-pg`. Drizzle's migration ledger
   (`drizzle.__drizzle_migrations`) travels with the dump, so the
   journal-tracked `release_command` stays a no-op after cutover - same
   property ADR 0005 relied on going the other way.
4. Verify **before** cutting over: row counts per table against the source,
   and specifically the tables that cannot be regenerated - accounts, chat
   histories, and the behavioural/safeguarding flags.
5. `fly secrets set --app hoe-sprout DATABASE_URL='postgres://...@hoe-pg.flycast/sprout'`.
   The secret change restarts the machines onto the new database.
6. Scale back up; verify sprout's deep `/health` (a real Store round-trip) and
   run a real chat end-to-end, the way P11 go-live was verified.
7. **Soak before deleting.** Leave the MPG cluster in place and paid for at
   least a week - it is the only rollback. Delete only after a clean soak and
   after the first scheduled offsite dump has been verified restorable.

## Code and docs that change

Little to none in the app - sprout only ever sees `DATABASE_URL`, which is the
whole point of the `@hoe/db` seam. What does change:

- `apps/sprout/fly.toml` - the HUMAN GO-LIVE NOTES block (note 2) instructs the
  next operator to provision MPG. Rewrite it.
- `apps/sprout/docs/go-live.md` - the Postgres row and "what differs" item 1
  (ticket 03 covers these; confirm they landed).
- `compose.yml` - check whether sprout's local DB service still matches the
  shared-cluster shape used by hub/fridge/wotd.

## Expected saving

~$38/mo plus the storage line, against a `hoe-pg` marginal cost of roughly
$0.08-0.30/mo for one more logical database (plus any volume growth at
$0.15/GB/mo, and the offsite dump storage).

## Comments
