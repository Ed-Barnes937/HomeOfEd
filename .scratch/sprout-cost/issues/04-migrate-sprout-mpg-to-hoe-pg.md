# 04 - Migrate sprout: MPG -> a `sprout` database in `hoe-pg`

**Status:** resolved (2026-11-02) - premise void, different shape shipped
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

## Deprecation: migrating onto a product Fly is sunsetting

Raised 2026-10-05 when a third party, reading ADR 0005, advised against using
`hoe-pg` on the grounds that "Fly no longer supports that kind of self-run
Postgres". Accurate enough to record, overstated as phrased. What is actually
known:

- Fly staff have confirmed the intent - "we are going to deprecate the current
  unmanaged 'automated postgres' templates for the new Managed Postgres
  offering" - with **no timeline announced**, no removal date, and no stated
  migration path for existing clusters
  ([community thread](https://community.fly.io/t/future-of-legacy-postgres/24609)).
- `fly postgres` commands still work; existing clusters keep running. Fly's
  stated plan is to publish equivalent scripts if the commands leave flyctl,
  and `postgres-flex` is open source, so it can be self-deployed indefinitely.
- "Unsupported" is not new. Fly's own doc has been titled
  [*This Is Not Managed Postgres*](https://fly.io/docs/postgres/getting-started/what-you-should-know/)
  since the Dec 2024 docs correction that ADR 0005 already cites. That is the
  deal at $2.17/mo, not a change of terms.

**This does not block the migration, but it does harden the preconditions.**
The offsite dumps above are the exit hatch as much as the backup: a `pg_dump`
restores into MPG, Hetzner, Neon or anything else, which is exactly what makes
a deprecated dependency survivable. Treat "we can leave in an afternoon" as a
property to verify during the restore rehearsal, not an assumption.

Add to step 0: **confirm `fly postgres` still creates and manages clusters** at
the time of migration (ticket 01 checks this). If the commands have gone,
the method changes - deploy `postgres-flex` from the open-source repo, or
reconsider the destination - but the verdict does not.

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


## Resolution (2026-11-02) - not as written

**There was no migration.** Ticket 02 established sprout is a solo in-house
demo and ticket 01 measured the database at 33 rows / 8.5 MB, all of it
reproducible from committed Drizzle migrations. With no data worth moving, the
work collapsed from a gated data migration to a rebuild: destroy, create empty,
run `migrate.ts`, re-register.

**Both gates are therefore void for this ticket**, and deliberately so:

- *Restore rehearsal.* It existed to stop children's data landing on an
  unrehearsed node. There was no such data, and sprout did not land on
  `hoe-pg` anyway. The gate returns before a real household pilot - it is
  **not** cancelled. See [ADR 0072](../../../docs/adr/0072-sprout-owns-its-postgres-and-triggers-are-scopes.md).
- *Scheduled offsite dumps.* Same reasoning; still required before a pilot.

**The destination changed too.** Not a logical database in `hoe-pg` but sprout's
own unmanaged cluster **`sprout-pg`** (shared-cpu-1x **512MB**, 1GB volume,
`--enable-backups`), ~$4.48/mo. The extra ~$1.91/mo over a `hoe-pg` database
buys an independent failure domain, restore granularity and upgrade schedule
for the app slated to hold family data. Ed's call, on the "separate instances"
requirement.

**Shipped:** `docs/runbooks/sprout-mpg-retirement.md`. MPG cluster destroyed;
`/health` green on `sprout-pg`; Tigris bucket `sprout-pg-postgres` created.
**-$39.58/mo.**

Two snags worth carrying forward:

- `--vm-size shared-cpu-1x` defaults to 256MB and Fly **refuses backups below
  512MB**. `--vm-memory 512` is mandatory, not a nicety.
- The runbook's first draft said `fly scale count worker=0 web=0`. **`web=0`
  removes the machine**, and `auto_start_machines` can only wake a machine that
  exists, so sprout went hard down with no way to revive it by request.
  `min_machines_running = 0` alone is what a web group needs. Fixed in the
  runbook with a recovery note.
