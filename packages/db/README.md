# @hoe/db

Drizzle client factory with the Postgres ↔ PGlite **driver swap**, plus the
migration/per-test-reset seams. Apps own their schema, queries, and Store
impls; this package only decides *which engine* backs the Drizzle client.

## Public API (T1.1 frozen contract)

```ts
type Driver = 'postgres' | 'pglite'
type DbClient<S> // a Drizzle client bound to the app's schema, driver-agnostic

// Driver-swap factory (async: drivers are lazy-loaded so `pg` never enters a
// browser bundle and `pglite` can be excluded from production builds)
function createDbClient<S>(
  opts:
    | { driver: 'postgres'; schema: S; url: string }
    | { driver: 'pglite'; schema: S; dataDir?: string },
): Promise<DbClient<S>>

// Apply SQL migrations in order (T2.1 replaces hand-written SQL with generate+apply)
function applyMigrations(db: DbClient<DbSchema>, migrations: readonly string[]): Promise<void>

// New in-memory PGlite, migrated at creation = per-test reset
function freshTestDb<S>(schema: S, migrations: readonly string[]): Promise<DbClient<S>>
```

## Usage

```ts
// dev/test (PGlite — Node-side or in-browser WASM; proven both ways in T1.1)
const db = await freshTestDb(hubSchema, migrations)

// production (real Postgres)
const db = await createDbClient({ driver: 'postgres', schema: hubSchema, url: DATABASE_URL })
```

`Store` is **app-defined**: each app declares its own Store interface and one
impl over `DbClient<S>`. Real vs simulator is just the injected client's
driver — never a second Store class.

## Notes

- The `postgres` branch is imported with `@vite-ignore` so bundlers skip it;
  PGlite is a normal (bundleable) lazy import. Excluding `pglite` from prod
  bundles is finalised in T2.1 with a CI assertion.
- Runs under native Node ESM type-stripping — see
  [ADR 0004](../../docs/adr/0004-typescript-source-exports.md) for the source
  conventions (explicit `.ts` extensions, erasable syntax only).

## Testing

Exercised end-to-end by `apps/hub` (dev middleware Node-side, `.iwft`
in-browser). T2.1 adds this package's own suite (both drivers, PG-feature
evidence list, prod-bundle exclusion assertion).
