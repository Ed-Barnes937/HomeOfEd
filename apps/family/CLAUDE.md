# family — the estate's identity and SaveStore service

One scale-to-zero Fly app (`hoe-family`, `family.homeofed.com`) that does two
things for every other app: it mints the family session token, and it stores
opaque save blobs. Rationale is [ADR 0070](../../docs/adr/0070-family-service.md);
the build sequence is `.scratch/family-first-slice/`.

**This app owns no account UI.** All of it is hub's, at `homeofed.com/account`
(decision 5, hard rule 2). The SPA here is a placeholder page that points at hub
and doubles as the smoke for the layered path.

## What is here today (ticket 02)

The shell and every wiring touchpoint, with no domain logic yet. The starter's
`greeting` demo is kept deliberately as a smoke, so the full path stays exercised
while the real routers are built:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Still stateless ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)), so
there is no `schema.ts`, `store.ts`, `migrations/`, `migrate.ts` or `@hoe/db`
dependency, and `/health` is a shallow liveness check.

## What arrives next

| Ticket | Adds |
| --- | --- |
| 03 | the `family` logical DB in `hoe-pg`: schema, migrations, `FamilyStore`, the `release_command`, a deep `/health` |
| 04 | the identity router: Better Auth behind the invite gate, and token minting |
| 05 | the save router: the `SaveStore` and its four guards |

The private key that signs tokens (`FAMILY_TOKEN_PRIVATE_KEY`) will live only
here, as a Fly secret. Consuming apps verify with the public half, which ships as
ordinary config in `@hoe/accounts`.

## Layout

```
src/
  server/           the backend (Node for dev/prod, in-browser for .iwft)
    handlers/       Handler classes — business logic, AppContext only
    router.ts       tRPC router; createTRPC<void>() until ticket 03
    simulator.ts    backendSimulator wiring: real router, no Store yet
    main.ts         prod entrypoint: createAppServer + shallow /health
    greeting.test.ts  Vitest unit — handler exercised over the auth seam
  pages/ features/  UI — the placeholder page and its query
  testing/          IwftApp harness + iwft fixture + page objects
  greeting.iwft.tsx whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3110 })
```

## Commands

- `pnpm dev --filter=family` — simulator mode on port **3010**.
- `pnpm --filter family run test` — Vitest then Playwright CT.
- `docker compose up family` — the real image on host port **8090**.

## Rules

- Server code changes go through TDD: unit test against the injected seams
  first, `.iwft` only for whole-page behaviour.
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3010, CT 3110, compose 8090.
- No app may import from here (hard rule 1). The shared contract other apps
  consume is `@hoe/accounts`, and the save router will `satisfies` its
  `FamilySaveContract`.
- Creating the Fly app, attaching Postgres and setting secrets are human-gated
  (ticket 08, [the go-live runbook](../../docs/runbooks/phase-4-go-live.md)).
