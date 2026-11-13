# apps/hub — scoped rules

The launcher/landing app at the apex `homeofed.com`. Routes: `/`, the
wordmark, the app rail (nav, links) and a "who's playing" chip linking to
`/account`; and `/account`, **the whole estate's account UI** (spec §6,
[ADR 0081](../../docs/adr/0081-hub-account-ui.md)): signed in, a "who is
playing" picker, with everything else at its child route `/account/settings`
([ADR 0103](../../docs/adr/0103-account-picker-and-settings.md)).
The `trpc.health()` DB round-trip stays wired server-side (router → handler →
Store) as the worked example, but neither page surfaces it. New apps are **not** copied from here — the copy base
is `templates/starter` ([ADR 0007](../../docs/adr/0007-reference-starter-app.md)).
hub keeps the DB layer as the worked example of a database-backed app; the
stateless baseline lives in the starter
([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)).

## Layout

```
src/
  server/           the app's backend (runs in Node for dev/prod, in-browser for .iwft)
    schema.ts       Drizzle schema (app-owned)
    migrations/     drizzle-kit output (`pnpm generate`) — SQL + meta/, committed
    migrations.ts   Vite ?raw glob loader → statement list (browser/vitest)
    store.ts        HealthStore interface + DrizzleHealthStore over DbClient
    handlers/       Handler classes — business logic, AppContext only
    router.ts       tRPC router; exports AppRouter type
    simulator.ts    backendSimulator wiring: real router + PGlite Store
    main.ts         prod entrypoint: createAppServer + real Postgres Store
    migrate.ts      release_command: run-once migrations (migratePostgres)
    health.test.ts  Vitest unit — handler with a hand-written Store fake
    store.test.ts   Vitest — DrizzleHealthStore over PGlite + the generated migrations
  pages/ features/  UI — SCSS modules, TanStack Router routes, query options
    pages/_paperTokens.scss  the warm-paper palette, one definition for every screen
    pages/account/    the /account screens: AccountPage, the WhoIsPlaying picker,
                    and SettingsPanel with its cards
    features/account/ the family-service seam: familyClient (context + prod
                    client), familyService (origin + cookie attributes per
                    hostname), accountError, accountQueries, lastSaved (the
                    "boop: saved 2 days ago" wording), returnTo (the one
                    way back to the app that sent a visitor) and silentRenewal
                    (re-minting with no screen), both ADR 0095
  testing/          IwftApp harness (in-browser backend) + iwft fixtures + page
                    objects; familyFixture.ts is the household the fake starts with
  home.iwft.tsx account.iwft.tsx  whole-frontend tests via the in-browser backend
vite.config.ts      react + simulatorPlugin (dev simulator mode)
drizzle.config.ts   drizzle-kit: schema → src/server/migrations
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3100 })
```

## Commands

- `pnpm dev --filter=hub` — simulator mode on port **3000** (real router +
  Node-side PGlite via Vite middleware; restart to pick up server changes).
- `pnpm test --filter=hub` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- `pnpm generate --filter=hub` — drizzle-kit migration from schema changes
  (`--custom` for hand-written SQL); commit the whole output folder.
- Prod (container/release): `pnpm build` then `pnpm start` (needs
  `DATABASE_URL`, see `.env.example`; default port 8080); `pnpm migrate` is the
  deploy-time release_command.

## Rules

- Server code changes go through TDD: unit test against a Store fake first,
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks
  to erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts`/`migrate.ts` run
  under native Node.
- Migrations are loaded two ways on purpose: `migrations.ts` (Vite `?raw` glob)
  for the .iwft browser bundle and vitest; `@hoe/db/node`'s fs loader for
  native-Node contexts (dev simulator, prod). Schema changes touch only
  `schema.ts` + `pnpm generate`.
- Ports: dev 3000, CT 3100 — a copied app must pick fresh ones (root CLAUDE.md
  checklist).
- **`/account` talks to the family service browser-direct.** Hub's backend,
  schema and `fly.toml` know nothing about it; everything goes through
  `@hoe/accounts`' identity client over a `FamilyIdentityContract` injected into
  `<App />`. Read
  [ADR 0078](../../docs/adr/0078-family-identity-auth-boundary.md) before
  touching any of it, and
  [ADR 0081](../../docs/adr/0081-hub-account-ui.md) for these screens:
  - **Identity calls are authorised by the Better Auth cookie session, never by
    the family token.** The token is not httpOnly, so letting it authorise an
    identity call would let any script on any estate subdomain erase a
    household.
  - **Hub's origin is the only one on the identity CORS tier**, which is why
    this UI lives here and not in each app (hard rule 2 agrees).
  - The "who's playing" pick writes `hoe_family_session` client-side from the
    mint reply. `familySessionCookieOptions(hostname)` decides `Domain` and
    `Secure`, because a browser refuses `Domain=.homeofed.com` from localhost;
    the `Max-Age` comes from the token's own `exp`, inside `@hoe/accounts`.
  - **There is no live dev sign-in.** Better Auth runs only in the family
    service's `main.ts`, so the simulator and the .iwft harness serve anonymous
    requests. `account.iwft.tsx` injects `FakeFamilyClient` through `IwftApp`,
    and a real sign-in needs the docker stack: `docker compose up family hub`,
    where `familyUrl` maps hub's compose port 8080 to family's 8092
    (`scripts/docker-stack-sign-in.mjs` drives it). Do not add a dev-only
    backdoor that stamps a parent.
- Card previews honour `prefers-reduced-motion`: a new card's drawer returns
  `drivePreview(frame, drive, settle)` (`pages/HomePage.tsx`) so that under
  reduce it draws `settle` frames once, never schedules rAF, and repaints on a
  theme change. Any other per-frame clock (the WOTD typewriter's interval) must
  be skipped under reduce too.
