# family — the estate's identity and SaveStore service

One scale-to-zero Fly app (`hoe-family`, `family.homeofed.com`) that does two
things for every other app: it mints the family session token, and it stores
opaque save blobs. Rationale is [ADR 0070](../../docs/adr/0070-family-service.md);
the build sequence is `.scratch/family-first-slice/`.

**This app owns no account UI.** All of it is hub's, at `homeofed.com/account`
(decision 5, hard rule 2). The SPA here is a placeholder page that points at hub
and doubles as the smoke for the layered path.

## What is here today (tickets 02 to 05)

The shell and every wiring touchpoint, the database layer, and both routers. The
starter's `greeting` demo is kept deliberately as a smoke, so the full path stays
exercised:

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
only by hub's account UI). The save router is authorised by the **family token**
instead (`@hoe/accounts`' provider). Both land on the same `ctx.auth`, and
**both arrive on the same request in the ordinary case** - a parent signed in on
hub who has picked which child is playing - **naming different people**. So
`familySeam` keeps them in separate fields and neither guard reads the other's:
a parent session is `id` + `kind: 'parent-session'`, a verified token is a
nested `saveAccount: { accountId, role, parentId? }`, `requireParent` accepts
only the first and `requireSaveAccount` only the second. **No save handler may
read `user.id`**: it is the cookie session's whenever there is one, so a handler
reaching for it would act for the parent while holding a child's token. The
reasoning, including why precedence between the two cannot work, is
[ADR 0079](../../docs/adr/0079-family-save-authorisation.md).

**Resolving the session is async; the seam is not.** `auth.api.getSession` is a
database call and `AuthProvider.getUser()` is synchronous, so a Fastify
`onRequest` hook stamps a server-trusted `x-family-parent` header, having first
**deleted any inbound value** - that strip is the whole anti-spoof story and is
pinned by `auth/parentSessionBridge.test.ts`. The sprout precedent is
[ADR 0012](../../docs/adr/0012-sprout-app-owned-auth.md).

Consequences worth knowing:

- **The bridge also relays Better Auth's `Set-Cookie`.** `getSession` slides the
  parent session as it reads it (`PARENT_SESSION_LIFETIME` in `betterAuth.ts`:
  90 days, pushed out at most once a day), and the browser learns of that only
  from the tRPC reply. Drop the relay and every parent is signed out 90 days
  after signing in, however often they use hub
  ([ADR 0070](../../docs/adr/0070-family-service.md), 2026-11-12 amendment,
  which also records the lost-device cost). Pinned over a real socket by
  `auth/parentSessionRefresh.test.ts`.
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
- **CORS governs what a browser may READ, never what it may SEND.** A
  CORS-simple request (`multipart/form-data`, `application/x-www-form-urlencoded`
  or `text/plain`) carries no preflight at all, so the allowlist never sees it
  and the mutation has already committed. That is not theoretical: it erased a
  household through `identity.deleteAccount` in the production image, because a
  procedure with no `.input()` never reads the request body. So `csrf.ts`
  refuses any non-GET `/api/trpc` request whose content type is not
  `application/json`, which forces the preflight the allowlist then governs
  ([ADR 0078](../../docs/adr/0078-family-identity-auth-boundary.md) decision 5).
  **Do not remove that hook, and do not add an input-less mutation**: the hook is
  the boundary, the input schemas are only defence in depth.
- `/api/auth/*` is outside that hook and relies on Better Auth's own origin
  check, which is global over every non-GET route and refuses both an untrusted
  and a missing origin when a cookie is present. It is **off by default under
  `NODE_ENV=test`**, so `betterAuth.ts` states `advanced.disableOriginCheck:
  false` rather than inheriting it - otherwise no test can see the control at all.
- CORS (`cors.ts`) is a hand-rolled allowlist with
  `Access-Control-Allow-Credentials: true`, registered through the
  `registerRoutes` hook. It is config, never `*`, and never reflects an
  unchecked origin. **It is split by what the route authorises**:
  `identityAllowedOrigins` is the hub account UI alone, because every estate
  subdomain is same-site and an app origin here would let an XSS in that app
  erase a household - **do not widen it**. `saveAllowedOrigins` is the save
  router's own tier and adds onboarded app origins on top, because that router
  is token-authorised and apps call it browser-direct. The tier is picked per
  request, and a batched tRPC path counts as a save request **only when every
  procedure in it is a save procedure**, or an app origin could hide
  `identity.deleteAccount` behind `save.get`. `Vary: Origin` does not survive on
  tRPC responses, so no cache rule may ever cover `/api/trpc`.
- The docker stack runs the production image, so its localhost origins come from
  `DOCKER_STACK_ORIGINS=on`, which only `compose.yml` sets: hub's compose
  origin joins the identity tier, onboarded apps' `composePort`s join the save
  tier, and nothing else. `loadFamilyEnv` refuses the variable on Fly at any
  value ([ADR 0078](../../docs/adr/0078-family-identity-auth-boundary.md)
  decision 6). Never key a localhost origin off `NODE_ENV` alone.
- `loadFamilyEnv` requires all four identity variables unconditionally, so a
  missing secret crashes the process at boot, and its failure message names the
  variables and never their values. **With `FLY_APP_NAME` present it refuses
  anything this repo publishes**: the committed `@hoe/accounts/testing` signing
  key, any `REGISTRATION_INVITE_CODE` or `BETTER_AUTH_SECRET` that **reads as a
  placeholder** (`dev-`, `insecure`, `change-me`, `placeholder`, `example`,
  leading `test`), either of those below a minimum length, and any `NODE_ENV`
  but `production` (CORS's dev origins and tRPC's stack traces both key off it),
  and the local-only `DOCKER_STACK_ORIGINS`.
  The placeholder, length and `NODE_ENV` rules live in `@hoe/deploy-guard`
  ([ADR 0088](../../docs/adr/0088-deploy-guard-package.md)), shared with sprout.
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

### The save half, and the four guards in front of it

`save.get/put/list/delete` are the SaveStore. Read
[ADR 0079](../../docs/adr/0079-family-save-authorisation.md) before touching any
of this.

- **`accountId` comes from the verified token and never from input.** The wire
  schemas in `@hoe/accounts` have no `accountId` field at all, and every handler
  builds its `SaveKey` field by field rather than spreading the input, so no
  future field can reach the key by accident.
- `requireSaveAccount` is the guard; it is positive on `role` and refuses a
  parent cookie session. `requireOnboardedApp` is the `appId` allowlist.
- **`onboardedApps.ts` is the one table** behind both the `appId` allowlist and
  the save CORS tier, so an app cannot be onboarded at one gate only.
- Quotas live in `handlers/saves/limits.ts`: 256 KiB a slot, 2 MiB an account
  **summed across every appId**, which is why the store has `saveUsage` as well
  as `listSaves`. A put prices its own overwrite by the difference, and the
  check is read-then-write, so a tiny concurrent overshoot is accepted.
- **Bytes are not the only resource.** An empty blob is free and `slotKey` is the
  app's own string, so `MAX_ACCOUNT_SLOTS` caps rows per account (new slots
  only, so a full account can still rewrite what it holds) and the contract
  bounds `slotKey` at 128 characters. One batched request is capped too, by
  `MAX_BATCH_SIZE` in `csrf.ts`.
- Both quota refusals and a refused `appId` are `ValidationError` (400); the
  taxonomy has no 413.
- **The server never parses `blob`.** It measures its bytes and stores it. "Can
  the server query inside a save?" is the question to refuse in review
  ([ADR 0070](../../docs/adr/0070-family-service.md)).

## What arrives next

The first slice's remaining tickets are hub's account UI, boop's sync module and
go-live; nothing further is owed inside this app.

The private key that signs tokens (`FAMILY_TOKEN_PRIVATE_KEY`) lives only here,
as a Fly secret. Consuming apps verify with the public half, which ships as
ordinary config in `@hoe/accounts`; this service derives its own from the
private key at boot rather than carrying a fifth variable.

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
    cors.ts         the two origin allowlists + their Fastify hook
    csrf.ts         the content-type hook that forces a preflight + MAX_BATCH_SIZE
    onboardedApps.ts  the apps the SaveStore serves: appIds and their origins
    fastifyBridge.ts  Fastify request -> fetch Request (Better Auth needs the body)
    auth/           betterAuth.ts (instance + invite gate), parentSession.ts
                    (ParentUser, SessionResolver), parentSessionBridge.ts (the
                    header bridge), familySeam.ts (the createContext auth seam:
                    both credentials, separate fields), tokenPort.ts
    handlers/       Handler classes — business logic, AppContext only;
                    authz.ts holds requireParent / requireOwnChild /
                    requireSaveAccount / requireOnboardedApp; saves/ holds the
                    four save handlers and their limits
    router.ts       createAppRouter(deps) factory; exports AppRouter
    simulator.ts    backendSimulator wiring: real router + PGlite Store
    main.ts         prod entrypoint: createAppServer, Better Auth, CORS
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
    store.test.ts   Vitest - DrizzleFamilyStore over PGlite + the migrations
    identity.test.ts  Vitest - the identity handlers over freshTestDb
    saves.test.ts   Vitest - the save handlers over freshTestDb, real tokens
                    through the real seam
    csrf.test.ts    Vitest - the preflight-free attack, over a real socket:
                    app.inject cannot express it
    env.test.ts cors.test.ts  the boot guard and the two allowlists
  pages/ features/  UI — the placeholder page and its query
  testing/          IwftApp harness + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
drizzle.config.ts   drizzle-kit: schema → src/server/migrations
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3112 })
```

## Commands

- `pnpm dev --filter=family` — simulator mode on port **3012**.
- `pnpm --filter family run test` — Vitest then Playwright CT.
- `pnpm --filter family run generate` - drizzle-kit migration from schema
  changes (`--custom` for hand-written SQL); commit the whole output folder.
- `docker compose up family` — the real image on host port **8092**.
- `node scripts/docker-stack-sign-in.mjs` (after `docker compose up -d --build
  family hub boop`) - a real browser sign-in through the stack.

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour.
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) - `simulator.ts`/`main.ts`/`migrate.ts` run under
  native Node.
- Ports: dev 3012, CT 3112, compose 8092.
- No app may import from here (hard rule 1). The shared contract other apps
  consume is `@hoe/accounts`: the save router `satisfies` its
  `FamilySaveContract` and takes its input schemas from there, so a change to
  the wire shape fails here at compile time. **The identity router does the
  same**, against `FamilyIdentityRouterContract` - the router half of the
  contract, split out because `signUp`/`signIn`/`signOut` are Better Auth
  endpoints no tRPC router could implement. Both bindings live in `router.ts` as
  `identityContractFor` / `saveContractFor`; keep every new procedure inside one
  of them.
- **Deleting a child profile is transactional.** `saves.accountId` carries no
  FK, so `deleteChildProfile` removes the profile and that `accountId`'s save
  rows together, scoped to the owning parent; a bare profile delete would
  strand the saves with nothing able to reference them. Same reasoning as
  `deleteAccount`; both are pinned by store tests.
- Creating the Fly app, attaching Postgres and setting secrets are human-gated
  (ticket 08, [the go-live runbook](../../docs/runbooks/phase-4-go-live.md)).
