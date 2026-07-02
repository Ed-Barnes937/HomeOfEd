# @hoe/db

Drizzle client factory with the Postgres ↔ PGlite **driver swap**, plus the
migration, seed, env, and per-test-reset seams. Apps own their schema, queries,
and Store impls; this package only decides *which engine* backs the Drizzle
client and how migrations/env are handled uniformly.

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

// Apply SQL migrations (one statement per string) in order
function applyMigrations(db: DbClient<DbSchema>, migrations: readonly string[]): Promise<void>

// New in-memory PGlite, migrated at creation = per-test reset
function freshTestDb<S>(schema: S, migrations: readonly string[]): Promise<DbClient<S>>
```

Added in T2.1 (the frozen surface above is unchanged):

```ts
// main entry — environment-agnostic
function migrationsFromFiles(files: Record<string, string>): readonly string[]
type SeedFn<S> = (db: DbClient<S>) => Promise<void>
function seedDb<S>(db: DbClient<S>, ...seeds: readonly SeedFn<S>[]): Promise<void>

// '@hoe/db/node' — Node-only (fs)
function loadMigrationsFromDir(dir: string): Promise<readonly string[]>
function migratePostgres(url: string, migrationsFolder: string): Promise<void>

// '@hoe/db/env' — Node-only (process.env)
const dbEnvSchema: ZodObject // { DATABASE_URL: postgres URL }
function loadDbEnv(source?: Record<string, string | undefined>): DbEnv
```

## Usage

```ts
// dev/test (PGlite — Node-side or in-browser WASM)
const db = await freshTestDb(appSchema, migrations)

// production (real Postgres) — env validated once at startup
import { loadDbEnv } from '@hoe/db/env'
const env = loadDbEnv() // throws a readable error at boot if invalid
const db = await createDbClient({ driver: 'postgres', schema: appSchema, url: env.DATABASE_URL })
```

`Store` is **app-defined**: each app declares its own Store interface and one
impl over `DbClient<S>`. Real vs simulator is just the injected client's
driver — never a second Store class.

## Migrations

**Generate** with drizzle-kit against the app's own schema. Each app adds
`drizzle-kit` as a devDependency plus a `drizzle.config.ts` (copy this
package's — point `schema`/`out` at the app's files) and a script:

```jsonc
"generate": "drizzle-kit generate"   // pnpm generate --filter=<app>
```

Commit the generated `out/` folder (the `NNNN_*.sql` files **and** `meta/` —
drizzle-kit needs the snapshots to diff the next migration).

**Load** the generated folder into the `readonly string[]` shape that
`applyMigrations`/`freshTestDb` take:

```ts
// Node (server entrypoint, vitest):
import { loadMigrationsFromDir } from '@hoe/db/node'
const migrations = await loadMigrationsFromDir(new URL('./migrations', import.meta.url).pathname)

// Browser (simulator / .iwft — Vite raw glob, no fs):
import { migrationsFromFiles } from '@hoe/db'
const files = import.meta.glob<string>('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const migrations = migrationsFromFiles(files)
```

Both order files by name (drizzle-kit's zero-padded prefixes) and split on
drizzle-kit's `--> statement-breakpoint` markers.

**Apply** — two seams for two jobs:

- **Fresh databases** (tests, simulator): the frozen `applyMigrations(db,
  migrations)` executes every statement, in order, identically on both drivers
  (proven in `migrations.test.ts` for PGlite and `postgres.test.ts` for real
  Postgres). `freshTestDb` wraps it.
- **Deploys** (`release_command`): `migratePostgres(url, migrationsFolder)`
  from `@hoe/db/node` — drizzle's journal-tracked migrator (ledger in
  `drizzle.__drizzle_migrations`), so running it on every deploy is safe:
  already-applied entries are skipped (proven in `migrator.test.ts`, incl. the
  re-run no-op). It needs the folder's `meta/` journal — another reason the
  whole `out/` dir is committed.

### Migration policy — forward-only / expand-contract

- Migrations only ever roll **forward**; there are no down migrations.
- Schema changes are **expand → migrate data → contract**: add the new
  column/table first (old code keeps working), ship code that uses it, and only
  then remove the old shape in a later migration. This is what makes deploy
  rollback safe — the previous release must run correctly against the migrated
  schema.
- A **destructive migration** (`DROP TABLE/COLUMN`, data-losing type change,
  destructive backfill) is **flagged in the PR and applied as a human-gated
  step** — it is **never** run silently by the deploy `release_command`.

## Seeding

No framework — a seed is any async function that writes through the client:

```ts
import { seedDb, type SeedFn } from '@hoe/db'

const seedUsers: SeedFn<typeof appSchema> = async (db) => {
  await db.insert(appSchema.users).values({ name: 'ed' })
}

const db = await freshTestDb(appSchema, migrations)
await seedDb(db, seedUsers) // variadic; seeds run in order
```

## Environment

`@hoe/db/env` validates the database environment through zod. Parse **once** at
the app's server entrypoint and pass the result down — don't sprinkle
`process.env` reads. It throws at boot with every problem listed, instead of
failing on the first query. `.env.example` in this package documents the
variables; copy to `.env` (gitignored) locally. In production the values come
from Fly secrets.

## Keeping PGlite out of production

`@electric-sql/pglite` is a **devDependency** (ADR 0001 §17): a production
`pnpm install --prod` never installs it, and dev/test/simulator use — always via
this package's source — still resolves it from this package's own node_modules.

If a production **bundle** includes `@hoe/db` (e.g. a bundled server), mark
pglite external so the lazy `import()` stays a bare specifier that prod code
never executes:

```ts
build: { rollupOptions: { external: ['@electric-sql/pglite'] } }
```

`prodBundle.test.ts` asserts this: it vite-builds a prod-shaped fixture on the
postgres driver path and fails if any pglite code (wasm/data assets or a
multi-MB chunk) lands in the output — plus a control build proving the detector
fires when the exclusion is removed. The reverse direction (`pg` out of the
browser) holds because browser code never takes the postgres branch: the import
is lazy and `@vite-ignore`d, and app browser bundles don't import `@hoe/db` at
all (data goes through tRPC).

## Postgres features apps may rely on (evidence-based)

The dev/test engine is PGlite, so the PGlite-vs-real-Postgres fidelity gap is
bounded by evidence: every feature below has a passing test in the shared suite
(`src/testing/featureSuite.ts`), run on **PGlite** in `pgFeatures.test.ts` and
on **real Postgres** in `postgres.test.ts`.

| Feature | Evidence (test name) |
|---|---|
| `gen_random_uuid()` column defaults | "gen_random_uuid() generates column defaults" |
| JSON/JSONB operators (`->>`, `@>`) | "JSONB operators: ->> extraction and @> containment" |
| Transactions (commit + rollback) | "transactions: commit persists, throw rolls back" |
| `NOT NULL` / `UNIQUE` constraints | "NOT NULL and UNIQUE constraints reject bad rows" |
| `FOREIGN KEY` constraints | "FOREIGN KEY constraints reject orphan rows" |
| `ON CONFLICT` (DO NOTHING / DO UPDATE) | "ON CONFLICT: DO NOTHING skips, DO UPDATE upserts" |

Need a feature not on the list (e.g. `LISTEN/NOTIFY`, full-text search)? Add a
test to the shared suite first; if PGlite supports it, extend this table.

## Testing

```bash
pnpm test --filter=@hoe/db          # vitest (*.test.ts) + Playwright CT (*.iwft.tsx)

# real-Postgres leg (skipped unless TEST_DATABASE_URL is set):
docker run -d --name hoe-db-test -p 5433:5432 -e POSTGRES_PASSWORD=postgres postgres:17
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres pnpm test --filter=@hoe/db
```

- `roundtrip.test.ts` — PGlite round-trip in Node, `freshTestDb` per-test
  isolation, `seedDb`.
- `pgliteBrowser.iwft.tsx` — PGlite round-trip **in Chromium** (WASM), loading
  migrations via the documented browser glob pattern.
- `migrations.test.ts` / `postgres.test.ts` — generate+apply on both drivers.
- `prodBundle.test.ts` — the pglite-absent-from-prod build assertion.
- The test schema/migrations under `src/testing/` are this package's own
  fixtures (regenerate with `pnpm generate --filter=@hoe/db`); apps own theirs.

## Notes

- Runs under native Node ESM type-stripping — see
  [ADR 0004](../../docs/adr/0004-typescript-source-exports.md) for the source
  conventions (explicit `.ts` extensions, erasable syntax only).
- The main entry is environment-agnostic; anything touching Node APIs lives in
  the `@hoe/db/node` and `@hoe/db/env` subpaths so it can never reach a browser
  bundle.
