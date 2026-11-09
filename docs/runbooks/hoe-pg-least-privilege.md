# Runbook: take superuser away from hoe-pg's app roles

One-off, human-run, about five minutes. The why is
[ADR 0086](../adr/0086-hoe-pg-least-privilege.md). After it, each app's role
(`hoe_family`, `hoe_fridge`, `hoe_hub`, `hoe_wotd`) is an ordinary user that
owns its own database and can connect to nothing else. Nothing restarts and no
secret changes.

Open a session as the cluster's superuser and keep it open for every step:

```bash
fly postgres connect -a hoe-pg
```

## 1. Pre-check (read-only)

A role that loses superuser can no longer alter an object it does not own, so
the first migration to touch such an object would fail at deploy. Paste this;
it lists every object in each app database that is **not** owned by that
database's app role.

```sql
\set foreign_owned 'SELECT current_database() AS db, kind, name, owner FROM (SELECT ''relation'' AS kind, n.nspname || ''.'' || c.relname AS name, pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname IN (''public'', ''drizzle'') UNION ALL SELECT ''schema'', nspname, pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = ''drizzle'' UNION ALL SELECT ''type'', n.nspname || ''.'' || t.typname, pg_get_userbyid(t.typowner) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = ''public'' AND t.typtype IN (''e'', ''d'')) o WHERE owner <> ''hoe_'' || current_database();'
\c family
:foreign_owned
\c fridge
:foreign_owned
\c hub
:foreign_owned
\c wotd
:foreign_owned
\c postgres
```

**Every result must be `(0 rows)`.** If any row appears, stop: that object
needs `ALTER ... OWNER TO hoe_<db>` first, and that is worth a conversation
rather than a guess.

## 2. Apply (one transaction)

```sql
BEGIN;
-- Ownership first: since Postgres 15 only a database's owner may create in its
-- public schema, so migrations depend on this once superuser is gone.
ALTER DATABASE family OWNER TO hoe_family;
ALTER DATABASE fridge OWNER TO hoe_fridge;
ALTER DATABASE hub    OWNER TO hoe_hub;
ALTER DATABASE wotd   OWNER TO hoe_wotd;
-- Every role may connect to every database by default; owners keep their own.
REVOKE CONNECT ON DATABASE family, fridge, hub, wotd, postgres, repmgr FROM PUBLIC;
ALTER ROLE hoe_family NOSUPERUSER;
ALTER ROLE hoe_fridge NOSUPERUSER;
ALTER ROLE hoe_hub    NOSUPERUSER;
ALTER ROLE hoe_wotd   NOSUPERUSER;
COMMIT;
```

If any statement errors, the transaction aborts and nothing has changed; type
`ROLLBACK;` and stop.

## 3. Verify

```sql
SELECT rolname, rolsuper FROM pg_roles WHERE rolname LIKE 'hoe\_%' ORDER BY 1;
SELECT datname, pg_get_userbyid(datdba) AS owner, datacl FROM pg_database
  WHERE datname IN ('family', 'fridge', 'hub', 'wotd') ORDER BY 1;
```

Every `rolsuper` is `f`, and each database is owned by its own role. Then,
outside psql:

```bash
for a in family fridge hub wotd; do curl -s "https://$a.homeofed.com/health"; echo " $a"; done
```

Each `/health` reads that app's database as its role, so four `{"ok":true}`
means every app still reaches its data. The next deploy of each DB-backed app
proves its migrations; re-running `deploy-family` from the Actions tab proves
family's now rather than later.

## Rollback

Each statement undoes one line of step 2. The ownership change can stay: it
grants nothing an app role did not already have as a superuser.

```sql
ALTER ROLE hoe_family SUPERUSER;
ALTER ROLE hoe_fridge SUPERUSER;
ALTER ROLE hoe_hub    SUPERUSER;
ALTER ROLE hoe_wotd   SUPERUSER;
GRANT CONNECT ON DATABASE family, fridge, hub, wotd, postgres, repmgr TO PUBLIC;
```
