# family — the estate's identity and SaveStore service

One scale-to-zero Fly app (`hoe-family`, `family.homeofed.com`) that does two
things for every other app: it mints the family session token, and it stores
opaque save blobs. Rationale is [ADR 0070](../../docs/adr/0070-family-service.md);
the build sequence is `.scratch/family-first-slice/`.

**This app owns no account UI.** All of it is hub's, at `homeofed.com/account`
(decision 5, hard rule 2). The SPA here is a placeholder page that points at hub
and doubles as the smoke for the layered path.

## What is here today (tickets 02, 03 and 04)

The shell and every wiring touchpoint, the database layer, and the identity
half. The starter's `greeting` demo is kept deliberately as a smoke, so the full
path stays exercised while the save router is built:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

The DB layer follows hub's verbatim: `schema.ts`, a committed `migrations/`
journal loaded two ways (`migrations.ts` for vitest/.iwft, `@hoe/db/node` for
native Node), `migrate.ts` as the `release_command`, and `FamilyStore` +
`DrizzleFamilyStore` with store tests over PGlite. `/health` is deep: `main.ts`
round-trips the Store to real Postgres.

### The identity half, and how its auth works

Two things in this app are easy to get wrong, so read this before touching
`src/server/auth/`. The reasoning is
[ADR 0078](../../docs/adr/0078-family-identity-auth-boundary.md).

**Two credentials, one `ctx.auth` seam.** The identity router is authorised by
the **Better Auth cookie session** (host-scoped to `family.homeofed.com`, used
only by hub's account UI). The save router will be authorised by the **family
token** instead (ticket 05, `@hoe/accounts`' provider). Both land on the same
`ctx.auth`, so a parent session carries `kind: 'parent-session'` and
`requireParent` accepts nothing else: a family token is readable by client JS on
every estate subdomain and must never authorise an identity procedure.

**Resolving the session is async; the seam is not.** `auth.api.getSession` is a
database call and `AuthProvider.getUser()` is synchronous, so a Fastify
`onRequest` hook stamps a server-trusted `x-family-parent` header, having first
**deleted any inbound value** - that strip is the whole anti-spoof story and is
pinned by `auth/parentSessionBridge.test.ts`. The sprout precedent is
[ADR 0012](../../docs/adr/0012-sprout-app-owned-auth.md).

Consequences worth knowing:

- Better Auth runs in `main.ts` **only**. The dev simulator and the .iwft
  harness serve `/api/trpc` alone, so every request there is anonymous and the
  identity procedures refuse. Hub's account flows are tested against
  `FakeFamilyClient`, and the real `/api/auth/*` path is proven by
  `auth/betterAuth.test.ts` (the real instance over PGlite) and `docker compose
  up family`.
- The token minter is injected: `createAppRouter({ mintToken })` is a factory
  because `FAMILY_TOKEN_PRIVATE_KEY` + `node:crypto` cannot come through
  `AppContext`. Prod closes over the Fly secret, the dev simulator over the
  committed `@hoe/accounts/testing` key, and the .iwft harness over a thrower.
- CORS (`cors.ts`) is a hand-rolled allowlist with
  `Access-Control-Allow-Credentials: true`, registered through the
  `registerRoutes` hook. It is config, never `*`, and never reflects an
  unchecked origin. **It is split by what the route authorises**:
  `identityAllowedOrigins` is the hub account UI alone, because every estate
  subdomain is same-site and an app origin here would let an XSS in that app
  erase a household. Onboarded app origins belong to the save router's own list
  (ticket 05) - do not widen this one. `Vary: Origin` does not survive on tRPC
  responses, so no cache rule may ever cover `/api/trpc`.
- `loadFamilyEnv` requires all four identity variables unconditionally, so a
  missing secret crashes the process at boot, and its failure message names the
  variables and never their values. **With `FLY_APP_NAME` present it refuses
  anything this repo publishes**: the committed `@hoe/accounts/testing` signing
  key, any `REGISTRATION_INVITE_CODE` or `BETTER_AUTH_SECRET` that **reads as a
  placeholder** (`dev-`, `insecure`, `change-me`, `placeholder`, `example`,
  leading `test`), either of those below a minimum length, and any `NODE_ENV`
  but `production` (CORS's dev origins and tRPC's stack traces both key off it).
  The pattern is the primary rule, not `COMMITTED_DEV_SECRETS`: a list only ever
  enumerates what somebody remembered, and `apps/sprout/.env.example` publishes
  a 32-character `...-change-me` secret that cleared both the list and the
  length floor. The key check compares against the imported constant, which is
  why the image still ships `packages/accounts/src/testing`, and a test re-reads
  `.env.example` and compose's family service - per name, per file - to prove
  whatever they commit is refused.
- The invite gate is **route-enumerated** (`ctx.path === '/sign-up/email'`), so
  a social provider or an anonymous / magic-link / email-otp / phone-number /
  admin plugin would open a `createUser` path it never sees. ADR 0057 rests on
  this gate, so `auth.options` is asserted whole - adding any option turns
  `auth/betterAuth.test.ts` red on purpose.

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
    env.ts          the four identity variables, required at boot
    cors.ts         the origin allowlist + its Fastify hook
    fastifyBridge.ts  Fastify request -> fetch Request (Better Auth needs the body)
    auth/           betterAuth.ts (instance + invite gate), parentSession.ts
                    (ParentUser, SessionResolver), parentSessionBridge.ts (the
                    header bridge + the createContext auth seam), tokenPort.ts
    handlers/       Handler classes — business logic, AppContext only;
                    authz.ts holds requireParent / requireOwnChild
    router.ts       createAppRouter(deps) factory; exports AppRouter
    simulator.ts    backendSimulator wiring: real router + PGlite Store
    main.ts         prod entrypoint: createAppServer, Better Auth, CORS
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
    store.test.ts   Vitest - DrizzleFamilyStore over PGlite + the migrations
    identity.test.ts  Vitest - the identity handlers over freshTestDb
    env.test.ts cors.test.ts  the boot guard and the allowlist
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
- **Deleting a child profile is transactional.** `saves.accountId` carries no
  FK, so `deleteChildProfile` removes the profile and that `accountId`'s save
  rows together, scoped to the owning parent; a bare profile delete would
  strand the saves with nothing able to reference them. Same reasoning as
  `deleteAccount`; both are pinned by store tests.
- Creating the Fly app, attaching Postgres and setting secrets are human-gated
  (ticket 08, [the go-live runbook](../../docs/runbooks/phase-4-go-live.md)).
