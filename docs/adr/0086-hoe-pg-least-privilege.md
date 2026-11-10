# 0086 - hoe-pg app roles are ordinary users that own their own database

- **Status:** Accepted
- **Date:** 2026-11-09
- **Amends:** [ADR 0005](0005-unmanaged-fly-postgres.md) (whose "scoped user"
  was in fact a superuser) and [ADR 0070](0070-family-service.md) (which
  recorded the exposure and accepted it for the pilot; this ends it).
- **Runbook:** [hoe-pg-least-privilege.md](../runbooks/hoe-pg-least-privilege.md)

## Context

ADR 0005 says `fly postgres attach` creates "a scoped user". It does not:
attach grants superuser unless told `--superuser=false`, and `go-live.sh` never
said so. On 2026-11-09 `fly postgres users list --app hoe-pg` showed every app
role (`hoe_family`, `hoe_fridge`, `hoe_hub`, `hoe_wotd`) as a superuser with
access to every database.

In practice that meant one SQL-executing bug in any app gave away the whole
cluster. A local rehearsal on Postgres 17.2, prod's version, showed
`hoe_fridge` reading parents' emails out of `family` and running a shell
command on the database machine through `COPY ... FROM PROGRAM`. Family holds
the estate's most sensitive data, children's included, and every future
database-backed app would have joined the same pool.

Row-level security was considered and does not address this. It separates
rows inside one table, superusers bypass it, and family already separates
households in its handlers.

## Decision

1. **Each app role owns its own database and nothing else.** On Postgres 15+
   only a database's owner may create in its `public` schema, so ownership is
   what lets an app's migrations keep working once superuser is gone; the
   rehearsal shows a non-owner's from-scratch migration failing with
   "permission denied for schema public".
2. **`CONNECT` is revoked from `PUBLIC`** on every database in the cluster,
   `postgres` and `repmgr` included, so a role can reach only the database it
   owns.
3. **No app role is a superuser.** Existing roles are changed by the runbook in
   one transaction; `go-live.sh` attaches new apps with `--superuser=false` and
   an explicit `--database-user`, then prints the two statements that make the
   role its database's owner, and waits until the human has run them before the
   first deploy.

`go-live.sh` prints the SQL instead of running it because neither
`fly postgres connect` nor `fly ssh console` takes SQL non-interactively
without reading the cluster's credentials out of the machine, and go-live is
human-run already.

## Consequences

- An app bug now reaches at most that app's own data.
- The superuser-only migration is the price: an extension, or anything else
  that needs superuser, now has to be run by a human as `postgres`. No app's
  migrations need one today.
- An object not owned by its app role would break that app's next migration.
  The runbook's pre-check lists any such object before anything changes.
- The rehearsal (fresh cluster, all four apps' migrations and servers, a
  future migration, a fresh attach, rollback and re-apply) lived in a scratch
  script, not the repo: it is one-off verification, and the runbook carries
  everything that has to be repeated.
