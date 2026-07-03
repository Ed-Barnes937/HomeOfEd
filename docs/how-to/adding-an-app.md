# How to add an app

The authoritative, followable procedure for adding a new app to the hub —
written to be executed top-to-bottom by a person **or an agent** given a prompt
like "make an app that does X". Follow the sections in order.

Two apps in the repo are your references:

- **`templates/starter`** — the stateless baseline (no database). The copy base.
- **`apps/hub`** — the database-backed reference. Copy DB files from here in §2.

Throughout: `<name>` = the app's short lowercase name (e.g. `weather`).
`<flyapp>` = its Fly app name (e.g. `hoe-weather`). `<Name>` = the domain noun
in PascalCase (e.g. `Weather`).

The rules in [root `CLAUDE.md`](../../CLAUDE.md) still apply — leaf nodes, no
shared UI, layered backend + DI, tRPC-only, TDD. This guide is *how*; the ADRs
are *why* ([0001](../adr/0001-foundation.md), [0006](../adr/0006-reference-starter-app.md),
[0007](../adr/0007-apps-without-a-database.md)).

---

## 0. Decide: does this app need a database?

Do this first — it determines whether you run §2. Output: **stateless** or
**database-backed**.

**It needs a database if _any_ of these are true:**

- Data must **survive restarts and redeploys**. Fly restarts machines; anything
  held only in process memory is lost.
- State is **shared** across users, sessions, or devices.
- You need to **query, filter, aggregate, or relate** records server-side.
- A **history / audit trail** must persist.

**It is stateless (no database) if the app is:**

- **Pure computation / transformation** — calculators, converters, formatters,
  generators.
- A **proxy or aggregator over external APIs** — fetches, combines, returns, and
  persists nothing of its own.
- **Client-only state** — everything lives in the browser (localStorage, the
  URL, IndexedDB).

**Tie-breakers:**

- **Auth does not require a database.** Auth is decentralised (a central identity
  provider verified through the `ctx.auth` seam — [ADR 0007](../adr/0007-apps-without-a-database.md)),
  so a login-gated app can still be stateless.
- **Caching an external response is not persistence.** If losing the cache on
  restart is harmless, stay stateless.
- **When unsure, start stateless.** A database is purely *additive* (§2) — there
  is nothing to tear down if you add it later.

---

## 1. Create the app (both paths)

Copy the stateless baseline. It compiles and its tests pass before you change a
line, so you always start from green.

```bash
cp -r templates/starter apps/<name>
```

Then change each touchpoint:

| # | File | Change |
|---|---|---|
| 1 | `apps/<name>/package.json` | `"name": "<name>"`; set the dev port in the `dev` script (`vite --port <devPort>`). |
| 2 | `apps/<name>/index.html` | `<title>`. |
| 3 | `apps/<name>/playwright-ct.config.ts` | `ctPort: <ctPort>`. |
| 4 | `apps/<name>/fly.toml` | `app = '<flyapp>'`. Leave `primary_region = 'lhr'`. |
| 5 | `apps/<name>/Dockerfile` | Replace `starter` in the `turbo prune` and `--filter` lines; replace every `templates/starter` path with `apps/<name>`. |
| 6 | `compose.yml` (repo root) | Copy the `starter` service pattern as a new `<name>` service (build context `.`, dockerfile `apps/<name>/Dockerfile`, fresh host port). A stateless app has **one** service, `command: node src/server/main.ts`, no `DATABASE_URL`, no `depends_on`. |
| 7 | `.github/workflows/deploy.yml` | Copy the `deploy-hub` job → `deploy-<name>`: the `APP_URL`, the affected check (`select(.name == "<name>")`), the `flyctl deploy --config apps/<name>/fly.toml` path, and the smoke `APP_URL`. |

**Ports must be unique across all apps.** In use: hub `3000`/`3100`, starter
`3001`/`3101`. Pick the next free pair (e.g. `3002`/`3102`).

The starter ships a `greeting` demo (handler, router, query, page, `.iwft` +
unit test) so the copy is immediately testable. Replace it with your app's real
routes, or keep it as a smoke while you build.

**Now run the [§3 verify loop](#3-verify-definition-of-done).** For a stateless
app it should pass immediately after the renames — that is your green baseline.

Subdomain, Cloudflare, and Fly app creation are **human-gated** — see §4.

---

## 2. Add a database (database-backed apps only)

**Skip this section entirely if §0 said stateless.**

Everything here has a working counterpart in `apps/hub` — copy the file, then
adapt the names. Do the steps in order.

### 2a. Dependencies + scripts — `package.json`

Add to `dependencies`:

```jsonc
"@hoe/db": "workspace:*",
"drizzle-orm": "0.45.2"
```

Add to `devDependencies`:

```jsonc
"drizzle-kit": "0.31.10"
```

Add to `scripts`:

```jsonc
"generate": "drizzle-kit generate",
"migrate": "node src/server/migrate.ts"
```

Then `corepack pnpm install`.

### 2b. Schema — `src/server/schema.ts`

Copy `apps/hub/src/server/schema.ts`. Define your tables with `drizzle-orm/pg-core`.
Export the schema object and its type:

```ts
export const <name>Schema = { /* your tables */ }
export type <Name>Schema = typeof <name>Schema
```

### 2c. Drizzle config — `drizzle.config.ts`

Copy `apps/hub/drizzle.config.ts` verbatim (dialect `postgresql`, schema
`./src/server/schema.ts`, out `./src/server/migrations`).

### 2d. Generate the first migration

```bash
corepack pnpm --filter <name> run generate
```

Writes `src/server/migrations/*.sql` + `meta/`. **Commit the whole folder.** For
hand-written SQL (e.g. a seed row), use `drizzle-kit generate --custom`.

### 2e. Migration loaders

- `src/server/migrations.ts` — copy **verbatim** from hub. This is the Vite
  `?raw` glob loader used by the `.iwft` browser bundle and vitest. Easy to
  forget; without it the `.iwft` harness can't migrate.
- `src/server/migrate.ts` — copy from hub; change the `app` label in the logger.
  This is the deploy-time `release_command` entrypoint.

### 2f. Store — `src/server/store.ts`

Copy hub's pattern: a `<Name>Store` **interface** (your whole server-side query
surface) plus `class Drizzle<Name>Store implements <Name>Store` over
`DbClient<<Name>Schema>`.

### 2g. Wire the Store type through the layers

- `src/server/router.ts`: `createTRPC<void>()` → `createTRPC<<Name>Store>()`.
- `src/server/handlers/*`: `Handler<In, Out, void>` → `Handler<In, Out, <Name>Store>`;
  read `ctx.store`. Drop the stateless `return Promise.resolve(...)` shortcut —
  a DB handler is `async` and does `await ctx.store.…`.
- The handler's unit test: inject a hand-written Store fake (see
  `apps/hub/src/server/health.test.ts`) instead of `store: undefined`.

### 2h. Inject the Store per transport

Three files change `store: undefined` to a real Store. Copy the exact wiring from
hub's equivalents.

- **`src/server/simulator.ts`** (dev) — Node-side PGlite:

  ```ts
  import { fileURLToPath } from 'node:url'
  import { freshTestDb } from '@hoe/db'
  import { loadMigrationsFromDir } from '@hoe/db/node'
  import { <name>Schema } from './schema.ts'
  import { Drizzle<Name>Store } from './store.ts'

  const migrations = await loadMigrationsFromDir(
    fileURLToPath(new URL('./migrations', import.meta.url)),
  )
  const db = await freshTestDb(<name>Schema, migrations)
  const store = new Drizzle<Name>Store(db)
  // pass `store` into createContext; make createSimulatorDispatch `async`.
  ```

- **`src/server/main.ts`** (prod) — real Postgres + **deep** health:

  ```ts
  import { createDbClient } from '@hoe/db'
  import { loadDbEnv } from '@hoe/db/env'

  const env = loadDbEnv()
  const db = await createDbClient({ driver: 'postgres', schema: <name>Schema, url: env.DATABASE_URL })
  const store = new Drizzle<Name>Store(db)
  // healthCheck becomes a real round-trip:
  //   healthCheck: async () => { await store.ping(); return { ok: true } }
  ```

- **`src/testing/IwftApp.tsx`** (`.iwft`) — in-browser PGlite + seeding:

  ```ts
  import { freshTestDb } from '@hoe/db'
  import { applyPendingSeed } from '@hoe/test-kit/browser'
  import { migrations } from '../server/migrations.ts'
  import { <name>Schema } from '../server/schema.ts'
  import { Drizzle<Name>Store } from '../server/store.ts'

  const db = await applyPendingSeed(await freshTestDb(<name>Schema, migrations))
  // store: new Drizzle<Name>Store(db)
  ```

  This is what makes `mountApp({ seed })` work in `.iwft` tests.

### 2i. Store test — `src/server/store.test.ts`

Copy `apps/hub/src/server/store.test.ts`: `freshTestDb(<name>Schema, migrations)`
then assert against the Drizzle store. This exercises your real SQL over PGlite
with the generated migrations.

### 2j. Test timeouts — `vitest.config.ts`

Add the PGlite WASM boot allowance (it exceeds vitest's 5s default on cold CI):

```ts
test: {
  // ...existing
  testTimeout: 30_000,
  hookTimeout: 30_000,
}
```

### 2k. Environment — `.env.example`

Add:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/<name>
```

### 2l. Deploy config

- **`fly.toml`** — add under a `[deploy]` block:

  ```toml
  [deploy]
    release_command = 'node src/server/migrate.ts'
  ```

  The `/health` check path is unchanged; it is now *deep* because `main.ts`'s
  `healthCheck` round-trips the Store (§2h).

- **`Dockerfile`** — three edits (compare against `apps/hub/Dockerfile`):
  1. **prod-deps** stage: add `--filter=@hoe/db` to the `pnpm install` filter list.
  2. **runtime** stage: add `COPY --from=pruner /app/out/full/packages/db ./packages/db`.
  3. the `rm -rf` line: add `node_modules/.pnpm/@electric-sql+pglite@*` — PGlite
     is `@hoe/db`'s dev/test dependency and **must not ship to prod** (asserted by
     ADR 0001 §5). It reappears once you depend on `@hoe/db`, so the removal must
     come back too.

- **`compose.yml`** — turn the single app service into hub's two-service pattern:
  set `command: sh -c "node src/server/migrate.ts && node src/server/main.ts"`,
  add `DATABASE_URL: postgres://postgres:postgres@<name>-db:5432/<name>`,
  `depends_on` the db, and add the `<name>-db` `postgres:17` service + a named
  volume. Copy hub's `hub` + `hub-db` services and rename.

### 2m. Postgres provisioning

Human-gated — see §4.

---

## 3. Verify (definition of done)

The app is not done until **all** of these pass. This is the loop: a failure
points at a specific missed touchpoint (see the map below).

```bash
corepack pnpm --filter <name> run lint
corepack pnpm --filter <name> run typecheck
corepack pnpm --filter <name> run test      # vitest (*.test) + Playwright CT (*.iwft)
corepack pnpm --filter <name> run build
```

> Use `corepack pnpm --filter <name> run <script>`, not `turbo run <script>`:
> `turbo run` shells scripts through an asdf `pnpm` shim that may have no version
> set locally, and fails with exit 126. CI uses corepack and is unaffected.

**Prod smoke** — proves the built artifact actually serves (not just that tests
pass):

_Stateless:_

```bash
corepack pnpm --filter <name> run build
PORT=8099 node apps/<name>/src/server/main.ts &
curl -fsS localhost:8099/health              # → {"ok":true}
curl -fsS localhost:8099/api/trpc/<proc>     # → your data
curl -fsS localhost:8099/ | grep '<div id="root">'
kill %1
```

_Database-backed_ — use the Docker stack (real image, real Postgres, migrations
run):

```bash
docker compose up <name>                     # builds the real Fly image
curl -fsS localhost:<port>/health            # → {"ok":true} (deep round-trip)
```

**Failure → touchpoint map:**

| Symptom | Likely cause |
|---|---|
| typecheck: `ctx.store` is `void`/never | §2g — Store generic not swapped in router/handlers |
| `Cannot find module '@hoe/db'` | §2a — dep missing or no `pnpm install` |
| `.iwft` blank page / dispatch never resolves | §2h `IwftApp.tsx` not wired, or §2e `migrations.ts` missing |
| vitest times out in `store.test` | §2j — PGlite timeouts not added |
| migrations don't apply / table empty | §2d not generated, or §2e `migrate.ts` |
| prod image build fails on pglite / image huge | §2l — `COPY packages/db` missing or pglite not removed |
| deployed `/health` returns 503 | §2h `main.ts` healthCheck, or DB not attached (§4) |

---

## 4. Deploy (human-gated)

Once §3 is fully green you have a **deploy-ready app**. The remaining steps
create or mutate real infrastructure and are **run by a human, never an agent**
(root `CLAUDE.md`). Hand off with: the app name, `<flyapp>`, the subdomain,
whether it's stateless or database-backed, and a pointer to
[`docs/runbooks/phase-4-go-live.md`](../runbooks/phase-4-go-live.md).

The human runs (full commands in the runbook):

```bash
fly apps create <flyapp>
# database-backed only:
fly postgres attach hoe-pg --app <flyapp> --database-name <name>
```

- **Cloudflare:** proxied CNAME `<name> → <flyapp>.fly.dev`, SSL/TLS **Full
  (strict)**.
- **Fly cert:** `fly certs add <name>.homeofed.com --app <flyapp>`.

`FLY_API_TOKEN` is already set org-wide (runbook G4.2), so the `deploy-<name>`
job you copied in §1 goes live automatically. **Merge to `main`** → the deploy
workflow deploys the affected app (running migrations via `release_command` for a
DB-backed app) → post-deploy smoke gates the rollout.

---

## When copying gets tedious

This is a copy-based flow by decision ([ADR 0006](../adr/0006-reference-starter-app.md)),
not a generator. If following §1/§2 by hand becomes a repeated chore — or an
agent keeps missing the same touchpoints — that is the trigger to build a
`turbo gen` generator. Revisit then, not before.
