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
are *why* ([0001](../adr/0001-foundation.md), [0007](../adr/0007-reference-starter-app.md),
[0008](../adr/0008-apps-without-a-database.md)).

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
  provider verified through the `ctx.auth` seam — [ADR 0008](../adr/0008-apps-without-a-database.md)),
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
mkdir apps/<name>
git archive HEAD:templates/starter | tar -x -C apps/<name>
corepack pnpm install
```

`git archive` copies only the starter's committed files. A plain `cp -r` also
copies its `node_modules` symlinks (and `dist/`), which then point at the
starter's dependencies rather than the new app's. `pnpm install` links the new
workspace package.

Then change each touchpoint:

| # | File | Change |
|---|---|---|
| 1 | `apps/<name>/package.json` | `"name": "<name>"`; set the dev port in the `dev` script (`vite --port <devPort>`). |
| 2 | `apps/<name>/index.html` | `<title>`. |
| 3 | `apps/<name>/playwright-ct.config.ts` | `ctPort: <ctPort>`. |
| 4 | `apps/<name>/fly.toml` | `app = '<flyapp>'`. Leave `primary_region = 'lhr'`. Keep or remove the `FAMILY_ACCOUNT_URL` line as [§1a](#1a-the-estate-gate-every-app) says. |
| 5 | `apps/<name>/Dockerfile` | Replace `starter` in the `turbo prune` and `--filter` lines; replace every `templates/starter` path with `apps/<name>`. |
| 6 | `compose.yml` (repo root) | Copy the `boop` service as a new `<name>` service (build context `.`, dockerfile `apps/<name>/Dockerfile`, fresh host port, and its two `FAMILY_*` lines - [§1a](#1a-the-estate-gate-every-app)). A stateless app has **one** service, `command: node src/server/main.ts`, no `DATABASE_URL`, no `depends_on`. |
| 7 | `.github/workflows/deploy.yml` | Copy the `deploy-boop` job to `deploy-<name>`: the `APP_URL`, the affected check (`select(.name == "<name>")`), the `flyctl deploy --config apps/<name>/fly.toml` path, and the smoke `APP_URL`. Not `deploy-hub`: hub is never gated, so its smoke demands a `200` index and fails a gated app's first deploy after Fly has already rolled it out. Then add `deploy-<name>` to the `record-deploys` job: its `needs:` list, a `<NAME>:` line in the record step's `env`, and an `add <name> "$<NAME>"` line, so a green deploy reaches the homepage. |
| 8 | `apps/<name>/src/server/main.ts`, `src/server/simulator.ts`, `src/testing/IwftApp.tsx` | The logger label `app: 'starter'` becomes `app: '<name>'`. |

**Ports must be unique across all apps.** This registry is the single source of
truth — read it, take the **next free** row, and add your app to it in the same
PR. Do **not** grep the tree for "next free" and guess: two apps built on
parallel branches will grep the same number and collide on merge (this is how
`karesansui` and `hirameki` both landed on 3006 — see the ⚠ below).

| App | dev | CT (`ctPort`) | compose host |
|---|---|---|---|
| `templates/starter` (copy base, never run live) | 3001 | 3101 | — |
| `hub` | 3000 | 3100 | 8080 |
| `boids` | 3001 | 3102 | 8081 |
| `fridge` | 3002 | 3103 | 8082 |
| `wotd` | 3003 | 3104 | 8083 |
| `sprout` | 3004 | 3105 | 8084 |
| `sprout-pipeline` (headless) | 3005 | — | 8085 |
| `espy` | 3006 | 3106 | 8086 |
| `karesansui` | 3007 | 3107 | 8087 |
| `boop` | 3008 | 3108 | 8088 |
| `silt` | 3009 | 3109 | 8089 |
| `orbi` (claimed on its in-flight branch) | 3010 | 3110 | 8090 |
| `armoury` | 3011 | 3111 | 8091 |
| `family` | 3012 | 3112 | 8092 |
| **next free** | **3013** | **3113** | **8093** |

> **⚠ Check unmerged branches too.** A port is "taken" the moment another
> in-flight branch claims it, not just when it reaches `main`. Before taking the
> next-free row, `git worktree list` / check open PRs for an app that grabbed it
> first. When you add your app, bump the **next free** row so the following app
> starts from the right number.

The starter ships a `greeting` demo (handler, router, query, page, `.iwft` +
unit test) so the copy is immediately testable. Replace it with your app's real
routes, or keep it as a smoke while you build.

**Now run the [§3 verify loop](#3-verify-definition-of-done).** For a stateless
app it should pass immediately after the renames — that is your green baseline.

Subdomain, Cloudflare, and Fly app creation are **human-gated** — see §4.

### 1a. The estate gate (every app)

Every app on `*.homeofed.com` sends a visitor with no family session to hub's
`/account` and back ([ADR 0093](../adr/0093-estate-gate.md)). Only hub, family,
sprout and sprout-pipeline are exempt. The starter arrives gated, so the copy
already has the server half; keep it:

- `src/server/main.ts` passes
  `documentGate: familyDocumentGateFromEnv(process.env, { publicPaths: [] })`.
  The gate is on exactly when `FAMILY_ACCOUNT_URL` is set. `pnpm dev` and
  `.iwft` never run this server, so they are ungated.
- `src/server/main.test.ts` boots that entrypoint on a real port and proves
  both modes.
- The template's `fly.toml` sets `FAMILY_ACCOUNT_URL =
  'https://homeofed.com/account'` under `[env]`. A copied app keeps that line
  only once the production key is committed (below).
- `Dockerfile` ships `@hoe/accounts` and `@hoe/deploy-guard` and deletes
  `packages/accounts/src/testing`, as
  [`packages/accounts/README.md`](../../packages/accounts/README.md#wiring-the-gate-in-an-app)
  describes.

What you add:

1. **`ESTATE_APPS`** in `packages/accounts/src/estateApps.ts`:
   `{ appId: '<name>', host: '<name>.homeofed.com', devPort, composePort }`,
   the ports from your registry row. Hub returns a visitor only to an origin
   listed there, so an app missing from it signs its visitors in and leaves
   them on hub.
2. **`compose.yml`**: the service must be named exactly the `appId`, and gets
   boop's two `environment` lines, copied verbatim:

   ```yaml
   environment:
     FAMILY_ACCOUNT_URL: http://localhost:8080/account
     FAMILY_TOKEN_PUBLIC_KEY: '<boop's value>'
   ports:
     - '<composePort>:8080'
   ```

   `packages/accounts/src/estateApps.test.ts` checks every `ESTATE_APPS` entry
   against `compose.yml`: that service publishes exactly one port,
   `'<composePort>:8080'`, and its `FAMILY_TOKEN_PUBLIC_KEY` is a single-quoted
   one-line PEM matching the key compose's `family` signs with. Run
   `corepack pnpm --filter @hoe/accounts run test`. That variable is for the
   docker stack only: never set it on Fly, where its presence refuses the boot.
3. **Share links**, only if the app has them: fragment share links live at
   `/shared`, and `main.ts` declares `publicPaths: ['/shared']`. The shared
   view writes nothing to `localStorage` or the SaveStore (ADR 0093 decision
   6). A server-backed share route declares its own prefix, as fridge's `/b/`.

**Before the first deploy.** A gated app refuses to boot on Fly until the
production verifying key is committed as `PRODUCTION_FAMILY_PUBLIC_KEY` in
`packages/accounts/src/familyVerifyingKey.ts` (see "The production key"
in the accounts README); the deploy then fails its health checks and
`go-live.sh` fails its verify step. On Fly that constant is the only key
(see "The verifying key" in the accounts README), so rotating it is a code
change and a redeploy, never a Fly variable. While it is still `null`, remove
the `FAMILY_ACCOUNT_URL` line from the app's `fly.toml`; putting it back later
is the one-line switch-on. `familyVerifyingKey.test.ts` in `@hoe/accounts`
fails while any `apps/*/fly.toml` sets the line and the constant is `null`.

To see the gate locally: `docker compose up --build family hub <name>`, then
open `http://localhost:<composePort>/` and you land on hub's sign-in.

### 1b. Saving work per profile (apps that save work)

Local saves belong to whoever is playing
([ADR 0094](../adr/0094-per-profile-local-saves.md)), and a page shows and
saves the work of one profile: the one it was opened for. boop is the reference
(`apps/boop/src/App.tsx`, `pages/views.tsx`, `pages/HomePage.tsx`). Every call
below is from `@hoe/accounts`; its README ("In a gated app's browser code")
has the detail.

1. **The page's player.** Read `readFamilySession()` once at the app's entry
   and hand it down (boop's `sync/FamilySessionContext.tsx`), so storage, the
   save client and the watcher can never disagree. Call
   `reloadOnPlayerChange(player)` where the profile's storage is built, not on
   `/shared`, so a tab whose player was switched elsewhere reloads when it is
   looked at again. On `/shared` a reload would throw away a visitor's edits.
2. **Storage.** On the app's own routes, build
   `profileStorage(window.localStorage, player, { keys, prefixes })` once per
   page. List the app's save keys exactly, and dynamic ones such as
   `silt:scene:<id>` by prefix. Device preferences (themes, settings, hints)
   stay out. Pass it wherever the code used `window.localStorage` for a save,
   as boop does through `persistence/SaveStorageContext.tsx`. Saves made before
   profiles existed are copied into each profile on its first open. IndexedDB
   or anything else not keyed by these names is scoped with `profileScopedKey`
   directly.
3. **`/shared`**, if the app has fragment share links. Add a route that renders
   the same page with `memoryStorage()` and no save client. Read the share
   payload with `arrivalFragment()`, never `location.hash` after mount (the
   router decodes it). Share builds `<origin>/shared<fragment>`. "Keep this"
   sends the item as it is now to `<origin>/`, where the gate asks who is
   playing.
4. **Sync**, if the app copies saves to the family SaveStore. Build
   `createFamilySaveClient({ baseUrl, accountId: player })` only when `player`
   is not null. The `slotKey` stays the unscoped key, because the server key
   already carries the account. Stop syncing for good on a
   `SaveAccountMismatchError`.
5. **Links.** The back arrow is `hubUrlFor(location.href)`, and a switch-player
   link is `switchPlayerUrlFor(location.href)` (no link when it is `null`).

Tests to copy from boop:
- `profiles.iwft.tsx`: one player's saves are not another's, and legacy saves
  appear for both.
- `sharedView.iwft.tsx`: `/shared` writes nothing; "Keep this" carries the
  fragment or the edits.
- `playerChange.iwft.tsx`: a switched player reloads the page, but not
  `/shared`, where the visitor's edit survives.

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

- **`src/server/main.test.ts`** (the entrypoint test) starts `main.ts` with
  only the env it names, so `loadDbEnv()` now throws at boot. Add a
  `DATABASE_URL` nothing listens on to the env `startMain` passes:

  ```ts
  env: { PATH: process.env.PATH ?? '', PORT: String(port), DATABASE_URL: 'postgres://gate-test@127.0.0.1:9/none', ...env },
  ```

  The Postgres pool connects lazily, so the server boots and the gate tests
  need no database; `/health` answers `503`, which the readiness poll accepts.

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
| `main.test.ts`: `main.ts exited with 1` and `Invalid database environment` | §2h - `DATABASE_URL` not added to `startMain`'s env |

---

## 4. Deploy (human-gated)

Once §3 is fully green you have a **deploy-ready app**. The remaining steps
create or mutate real infrastructure and are **run by a human, never an agent**
(root `CLAUDE.md`). Hand off with: the app name, `<flyapp>`, the subdomain,
whether it's stateless or database-backed, and a pointer to
[`docs/runbooks/phase-4-go-live.md`](../runbooks/phase-4-go-live.md).

The human runs the whole sequence as one command (runbook G4.9,
[ADR 0011](../adr/0011-scripted-go-live.md)):

```bash
scripts/go-live.sh <name>        # stateless; add --db for database-backed
```

Or manually (full commands in the runbook):

```bash
fly apps create <flyapp>
# database-backed only:
fly postgres attach hoe-pg --app <flyapp> --database-name <name> \
  --database-user <flyapp_with_underscores> --superuser=false
# then, in `fly postgres connect -a hoe-pg`, before the first deploy (ADR 0086):
#   ALTER DATABASE <name> OWNER TO <flyapp_with_underscores>;
#   REVOKE CONNECT ON DATABASE <name> FROM PUBLIC;
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

This is a copy-based flow by decision ([ADR 0007](../adr/0007-reference-starter-app.md)),
not a generator. If following §1/§2 by hand becomes a repeated chore — or an
agent keeps missing the same touchpoints — that is the trigger to build a
`turbo gen` generator. Revisit then, not before.
