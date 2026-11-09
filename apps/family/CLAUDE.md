# family — the estate's identity and SaveStore service

One scale-to-zero Fly app (`hoe-family`, `family.homeofed.com`) that does two
things for every other app: it mints the family session token, and it stores
opaque save blobs. Rationale is [ADR 0070](../../docs/adr/0070-family-service.md);
the build sequence is `.scratch/family-first-slice/`.

**This app owns no account UI.** All of it is hub's, at `homeofed.com/account`
(decision 5, hard rule 2). The SPA here is a placeholder page that points at hub
and doubles as the smoke for the layered path.

## What is here today (tickets 02 and 03)

The shell and every wiring touchpoint, plus the database layer, with no domain
logic yet. The starter's `greeting` demo is kept deliberately as a smoke, so the
full path stays exercised while the real routers are built:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

The DB layer follows hub's verbatim: `schema.ts`, a committed `migrations/`
journal loaded two ways (`migrations.ts` for vitest/.iwft, `@hoe/db/node` for
native Node), `migrate.ts` as the `release_command`, and `FamilyStore` +
`DrizzleFamilyStore` with store tests over PGlite. `/health` is deep: `main.ts`
round-trips the Store to real Postgres. No tRPC procedure reads the Store yet,
so the transports still inject none and the router stays `createTRPC<void>()`.

### Schema invariants worth knowing before you change it

- `user` / `session` / `account` / `verification` are Better Auth's stock
  tables, declared here. **Better Auth's own migrator is never used**, and there
  are no sprout-style legal-attestation columns (the gate is the invite code
  plus [ADR 0057](../../docs/adr/0057-family-service-legal-gate.md)).
- `child_profiles.parentId` is an FK to `user.id`, `onDelete: cascade`. **No
  child email and no child credentials, ever** (spec §4.3).
- `saves.accountId` holds either a parent `user.id` or a `child_profiles.id`, so
  it carries **no FK**. Erasure is therefore `deleteAccount`'s explicit
  transaction, pinned by a store test; do not "fix" the missing FK.
- `saves` is keyed `(appId, accountId, slotKey)`, `slotKey` is the app's
  localStorage key verbatim, `blob` is text (localStorage values are strings),
  and `version` bumps on every put. The server never parses `blob`.

## What arrives next

| Ticket | Adds |
| --- | --- |
| 04 | the identity router: Better Auth behind the invite gate, token minting, and the Store injected into the transports |
| 05 | the save router: the `SaveStore` and its four guards |

The private key that signs tokens (`FAMILY_TOKEN_PRIVATE_KEY`) will live only
here, as a Fly secret. Consuming apps verify with the public half, which ships as
ordinary config in `@hoe/accounts`.

## Layout

```
src/
  server/           the backend (Node for dev/prod, in-browser for .iwft)
    schema.ts       Drizzle schema (app-owned): Better Auth's four + ours
    migrations/     drizzle-kit output (`pnpm generate`) - SQL + meta/, committed
    migrations.ts   Vite ?raw glob loader → statement list (browser/vitest)
    store.ts        FamilyStore interface + DrizzleFamilyStore over DbClient
    migrate.ts      release_command: run-once migrations (migratePostgres)
    handlers/       Handler classes — business logic, AppContext only
    router.ts       tRPC router; createTRPC<void>() until ticket 04
    simulator.ts    backendSimulator wiring: real router, no Store yet
    main.ts         prod entrypoint: createAppServer + real Postgres Store
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
    store.test.ts   Vitest - DrizzleFamilyStore over PGlite + the migrations
  pages/ features/  UI — the placeholder page and its query
  testing/          IwftApp harness + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
drizzle.config.ts   drizzle-kit: schema → src/server/migrations
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3110 })
```

## Commands

- `pnpm dev --filter=family` — simulator mode on port **3010**.
- `pnpm --filter family run test` — Vitest then Playwright CT.
- `pnpm --filter family run generate` - drizzle-kit migration from schema
  changes (`--custom` for hand-written SQL); commit the whole output folder.
- `docker compose up family` — the real image on host port **8090**.

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour.
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) - `simulator.ts`/`main.ts`/`migrate.ts` run under
  native Node.
- Ports: dev 3010, CT 3110, compose 8090.
- No app may import from here (hard rule 1). The shared contract other apps
  consume is `@hoe/accounts`, and the save router will `satisfies` its
  `FamilySaveContract`.
- Creating the Fly app, attaching Postgres and setting secrets are human-gated
  (ticket 08, [the go-live runbook](../../docs/runbooks/phase-4-go-live.md)).
