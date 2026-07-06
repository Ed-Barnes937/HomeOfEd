# Technical spec — migrating child-safe-llm into the HomeOfEd monorepo (`sprout`)

**Status:** Draft for review
**Author:** drafted with Claude
**Source:** `~/Code/Worktrees/review-f7a94317` (child-safe-llm)
**Target:** `~/Code/HomeOfEd` (App Hub) — this plan lives at `docs/plans/0004-sprout-migration-plan.md`
**App name:** `sprout` → `apps/sprout` (web) + `apps/sprout-pipeline` (LLM service); Fly `hoe-sprout` / `hoe-sprout-pipeline`; `sprout.homeofed.com`

---

## 1. What this is

A plan to move the child-safe LLM chatbot out of its standalone repo and into the HomeOfEd
monorepo, conforming to HomeOfEd's rules (tRPC + DI + Store interfaces, Vite SPA, Drizzle/PGlite
fakes, Fly.io single-container-per-app deploy, SCSS modules, the documentation discipline). The
end state is a deployable, tested, production app on `sprout.homeofed.com` plus an isolated
pipeline service, both following the "adding an app" procedure.

**This is a large migration.** It is not a lift-and-shift. The backend API is rebuilt (REST-over-
Vite-middleware → tRPC handlers), the frontend framework changes (TanStack Start SSR → Vite SPA),
the test harness is replaced (hand-rolled BackendSimulator → real-router-over-PGlite), the styling
is rewritten (Tailwind → SCSS modules), and two Fly apps are stood up. The safety pipeline's core
logic (the part with the most value) ports with the least change.

---

## 2. Why the fit is good (and where it isn't)

HomeOfEd was partly designed **with this app in mind**. That is not a coincidence to gloss over —
it means the hard platform decisions already went your way:

| HomeOfEd decision | Driven by / relevant to this app |
|---|---|
| Fly.io, **London (LHR)** region | `docs/hosting.md`: chosen over Railway *specifically* because Railway's EU region is Amsterdam and fails UK data residency for the child-safe app. |
| One database per app, in-region | ADR 0001 §6 cites "residency for the child-safe app." |
| **Separate Fly app** for secret/attack-surface isolation | ADR 0001 §3's escalation table names "e.g. the child-safe LLM app" as the example. The pipeline-as-separate-service is endorsed by the platform. |
| Streaming stays in the single container | `docs/hosting.md` describes "a child-safe platform… intercepts AI-service responses, runs evals, then streams them back" as the motivating app; ADR 0001 §3 confirms SSE does not force a split. |
| The whole test architecture | `docs/reference/genio-backend-simulator-pattern.md` is a study of **this codebase** (genio.co). The BackendSimulator → PGlite move is documented there as a planned *improvement*, not a hurdle. |

**The migration also resolves four open review issues for free** by rebuilding the API the
HomeOfEd way:

- **#42** (API is a Vite dev-only middleware, no prod request path) — dissolved: tRPC + `createAppServer` is one code path for dev, `.iwft`, and prod.
- **#34** (server-side child session token) — becomes an `AuthProvider` behind the frozen `ctx.auth.getUser()` seam.
- **#35** (inconsistent authorization / IDOR) — ownership checks live in handler classes over the injected Store; identity comes from `ctx.auth`, never the request body/query.
- **#36** (client-controlled sliders) — handlers load sliders from the Store by authenticated `childId`; the client stops authoring them.

**Where the fit is imperfect** (these are the real work, detailed later):

1. The web app is **TanStack Start (SSR)**; HomeOfEd's `.iwft` harness only supports the **SPA**
   model (the Start harness is explicitly deferred and does not exist). → the web app must convert
   to a Vite SPA.
2. **SSE streaming plumbing does not exist** anywhere in HomeOfEd. tRPC there is buffered
   `httpBatchLink` only. → we build the first streaming transport (decided: a plain SSE route).
3. The **pipeline is headless** (no SPA, no DB), so it cannot use `createAppServer` (which serves an
   SPA + tRPC). → a sanctioned deviation: a separate Fly app whose thin HTTP layer is **ported from
   Hono to bare Fastify** (so the whole repo runs one HTTP framework), adopting the shared plumbing
   (config, logger, Docker/CI) but not `createAppServer`.
4. A **scheduled retention/purge job** is needed (compliance). ADR 0001 §3 maps this to
   `[processes] web + worker` in one Fly app — but no such worker exists in the repo yet. → first of its kind.
5. **Better Auth** (per-app user/session tables, cookie sessions) runs *against* HomeOfEd's stated
   future direction (decentralised, token-based, DB-less identity). → kept for V1 as an app-owned
   provider behind the seam, recorded in an ADR.

---

## 3. Target architecture

```
apps/sprout/                      web app — Vite SPA + Fastify (createAppServer) + SSE route
  src/
    server/
      schema.ts                   ALL Drizzle tables (app + Better Auth), one schema
      store.ts                    SproutStore interface + DrizzleSproutStore
      migrations/                 committed drizzle-kit generate output (+ meta/ journal)
      migrations.ts               Vite ?raw glob loader (browser/vitest)
      migrate.ts                  release_command entrypoint (migratePostgres)
      main.ts                     prod entry: Postgres driver, deep health, SSE route, Better Auth handler
      worker.ts                   retention/purge process ([processes] worker)
      simulator.ts                dev transport: PGlite via loadMigrationsFromDir
      router.ts                   createTRPC<SproutStore>() + all procedures
      handlers/                   one Handler class per procedure (business logic + ownership checks)
      auth/                       Better Auth config + AuthProvider adapters (parent + child)
      chat-sse.ts                 the plain SSE route handler (calls the pipeline, persists flags)
    features/                     TanStack Query option factories over the tRPC client
    routes/                       TanStack Router file routes (SPA, no SSR)
    components/                   React components, SCSS modules
    pages/ or route components    screens
    testing/
      IwftApp.tsx                 in-browser PGlite + real router
      iwftTest.tsx                createIwftTest(...)
      *PagePom.ts                 Page Object Models
    *.iwft.tsx                    whole-frontend tests
  drizzle.config.ts
  fly.toml  Dockerfile  playwright-ct.config.ts  vite.config.ts  vitest.config.ts

apps/sprout-pipeline/             headless LLM safety service (bare Fastify, separate Fly app)
  src/
    index.ts                      orchestrator (unchanged logic; Fastify HTTP; DI the OpenAI client)
    <safety modules>              blocklist, canonicalise, crescendo, opinion-vote, … (port as-is)
    eval/                         adversarial eval ratchet (port as-is)
    *.test.ts                     vitest unit suites (port as-is)
  fly.toml  Dockerfile

packages/  (HomeOfEd's existing shared plumbing — consumed, not modified except the kit SSE hook)
  config  db  backend-kit  logger  test-kit
```

**Request paths (one per concern):**

- **tRPC** (`/api/trpc/*`) — everything except auth and chat streaming. Same router runs in dev
  (Vite middleware + PGlite), `.iwft` (page.route trampoline + in-browser PGlite), and prod
  (Fastify + real Postgres).
- **Better Auth** (`/api/auth/*`) — mounted as a Fastify route in `main.ts`; the `AuthProvider`
  reads the resulting cookie in `ctx.auth`.
- **Chat SSE** (`/api/chat/stream`) — a plain `text/event-stream` Fastify route; the web app holds
  the browser connection, calls the pipeline over Fly private networking, persists flag events to
  its DB, forwards tokens.

**Inter-service:** web → pipeline over Fly's **private network** (`hoe-sprout-pipeline.flycast`),
not a public URL. Keep the `x-pipeline-key` header as defence in depth. The pipeline is not
publicly routed.

---

## 4. Decisions taken (override if you disagree)

| # | Decision | Rationale | ADR to write |
|---|---|---|---|
| D1 | **Convert UI to SCSS modules** | Conform to HomeOfEd baseline (ADR 0001 §17). Chosen over keeping Tailwind. | — (follows existing ADR) |
| D2 | **Merge Better Auth tables into the single app schema** | One `drizzle.config.ts` + one migrations journal per app, per the repo convention; drizzle-kit generates auth + app tables together. | Note in the auth ADR (D5) |
| D3 | **Plain SSE route for token streaming** | Simplest; mirrors current design; the backend-kit README reserves REST/streaming as a thin transport beside tRPC. | `apps/sprout/CLAUDE.md` + a short kit ADR for the `createAppServer` route hook |
| D4 | **App name `sprout`** | Chosen. | — |
| D5 | **Keep Better Auth for V1, app-owned, behind `ctx.auth`** | The decentralised identity service HomeOfEd intends does not exist yet; Better Auth works and is already integrated. Documented divergence. | **New ADR** — "sprout brings its own auth provider" |
| D6 | **Web app → Vite SPA** (drop TanStack Start/SSR) | Required: the `.iwft` harness only supports SPA; the app has no SEO need (authed). | Note in `apps/sprout/CLAUDE.md` |
| D7 | **Pipeline: separate Fly app, port Hono → bare Fastify** | Endorsed by ADR 0001 §3 (secret isolation). Porting the thin HTTP layer removes the estate's only non-Fastify server; the port is small (only `index.ts` is framework-coupled) and gated by the new orchestrator test. **No shared factory yet** — one headless service doesn't justify the abstraction; extract a `createServiceServer` if a second appears (Appendix A). Adopts shared config/logger/Docker/CI. | **New ADR** — "headless service app shape" |
| D8 | **Retention/purge as a `worker` process in the web Fly app** | ADR 0001 §3: background/scheduled = multi-process, same Fly app. | **New ADR** — "first worker process / scheduled work pattern" |
| D9 | **Add a minimal route-registration hook to `createAppServer`** | So the SSE route and the Better Auth handler mount cleanly beside the tRPC plugin without forking `buildAppServer`. Small, additive, contract-respecting. | Short kit ADR |
| D10 | **Managed Fly Postgres (MPG), not unmanaged** | ADR 0005 names "the child-safe LLM app goes live" as the trigger to move from unmanaged to Managed Postgres (backups/replication for compliance weight). | Note in go-live handoff |

---

## 5. Component-by-component mapping

### 5.1 Backend API — the largest rebuild

**Source:** `apps/web/src/lib/auth-middleware.ts` (dev-only prefix router) + `apps/web/src/server/api-handlers.ts` (business logic) + `apps/web/src/api/*.ts` (plain-fetch clients) + `apps/web/src/queries/*.ts` (Query hooks).

**Target:** tRPC router (`router.ts`) + one `Handler` class per procedure (`handlers/*`) + Store
(`store.ts`) + tRPC client + `features/*` Query option factories.

The endpoint surface is already enumerated for you in the source at
`apps/web/src/test/backend-simulator/Endpoint.testHelper.ts` (~30 `EndpointKey`s) — that is your
procedure checklist. Group them into nested tRPC routers, e.g.:

```
children.{list, get, create, update, config, stats, preset, calibration}
children.topics.{list, add, remove}
childAuth.{loginPassword, loginPin, changePassword, deviceChildren}
conversations.{list, get, messages, saveMessage, summary, summariseAndPurge, delete}
flags.{list, create, review}
```

**Per procedure, the recipe (from `apps/fridge`):**

1. Add the query method to the `SproutStore` interface; implement it in `DrizzleSproutStore` over `DbClient<SproutSchema>`.
2. Write `class XHandler extends Handler<In, Out, SproutStore>`; `async run(input, ctx)`; read only
   `ctx.store` / `ctx.auth` / `ctx.now` / `ctx.logger`; **derive all identity from `ctx.auth`, never
   the input**; throw the domain error taxonomy (`ForbiddenError`, `NotFoundError`, …).
3. Wire it: `t.procedure.input(zodSchema).query|mutation(({ input, ctx }) => new XHandler().run(input, ctx))`.
4. Unit-test the handler with a hand-written `FakeSproutStore` + `makeCtx` literal (Vitest).

**Authorization (resolves #34/#35/#36):** every child-scoped procedure gets `childId`/`parentId`
from `ctx.auth.getUser()`, then verifies ownership against the Store (mirror fridge's pattern; add
`verifyConversationOwnership`). Chat handlers load sliders/calibration/preset from the Store by the
authenticated `childId` — the client no longer sends them.

### 5.2 Auth (Better Auth) — merged schema, two providers behind one seam

- **Config:** port `apps/web/src/lib/auth.ts` (Better Auth, email+password, Drizzle adapter,
  `subscriptionStatus` field) into `apps/sprout/src/server/auth/`. Point Better Auth's Drizzle
  adapter at the app's single `DbClient`.
- **Schema:** fold `apps/web/src/lib/auth-schema.ts` (`user`/`session`/`account`/`verification`)
  into `apps/sprout/src/server/schema.ts` alongside the app tables. Delete the second
  `drizzle-auth.config.ts` and the `tablesFilter` split — one config, one journal (D2).
- **The `children.parentId` / `devices.parentId` link:** currently plain `text` with no FK
  (separate migration domains). With one schema you *can* add a real FK to `user.id`. Recommended,
  but optional — call it out in the schema migration.
- **Two identities, one seam:** parent (Better Auth cookie session) and child (the #34 signed
  session token) are two `AuthProvider` implementations chosen per-route/per-router. `User =
  { id: string }` extended by intersection to carry `role: 'parent' | 'child'` and `parentId`.
  Replace the unsigned localStorage child session with a signed token (HMAC with `BETTER_AUTH_SECRET`
  or a dedicated secret) read server-side in the child `AuthProvider`.
- **Better Auth migrations:** stop using Better Auth's own migration mechanism; its tables are now
  in the app's committed `migrations/` and applied by `migratePostgres` like everything else.

### 5.3 Frontend — TanStack Start SSR → Vite SPA (D6)

- Remove `@tanstack/react-start`, `ssr.tsx`, the `.output` server, and the `tanstackStart()` Vite
  plugin. Keep **TanStack Router** (file-based routing works in SPA) and **TanStack Query**.
- Entry becomes `main.tsx` (`createRoot(#root).render(<App/>)`) + `App.tsx`
  (`QueryClientProvider` → `RouterProvider`), copied from `templates/starter` and grown.
- Replace `src/api/*.ts` (plain fetch) and `src/queries/*.ts` with a tRPC client
  (`createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: '/api/trpc' })] })`) and
  `features/*/xQuery.ts` `queryOptions` factories calling `trpcClient.*` (starter pattern).
- Better Auth in an SPA: the client calls `/api/auth/*`; the Fastify server serves Better Auth;
  the session cookie flows normally. No SSR needed.
- The DTO types in `src/api/types.ts` (228 lines) are largely replaced by tRPC's inferred types;
  keep any that are genuinely shared domain types in `packages/shared` (see 5.6).

### 5.4 Streaming (D3) — plain SSE route

- **Kit change (D9):** add an optional `registerRoutes?(app: FastifyInstance)` hook to
  `createAppServer` in `packages/backend-kit/src/server/createAppServer.ts` (it currently only
  exposes routes via the internal `buildAppServer`). Mount it before the SPA fallback.
- **Web route:** `apps/sprout/src/server/chat-sse.ts` registers `POST /api/chat/stream`
  (`text/event-stream`). It authenticates via the child `AuthProvider`, loads guardrail config from
  the Store, calls the pipeline over the private network, streams pipeline tokens to the browser,
  and **persists `flag` events to the DB** as they arrive (the pipeline stays DB-less).
- **Client:** port `apps/web/src/hooks/useChat.ts` SSE reader. **Fix the frame-boundary bug** noted
  in the prior review (the reader splits on `\n` with no buffer across reads → dropped tokens);
  buffer partial frames. Add an `AbortController` for unmount/cancel.
- **`.iwft` testing of chat:** the SSE route is not tRPC, so it is not served by the PGlite
  trampoline. Keep a **`page.route` SSE simulator** (the sanctioned fallback) equivalent to today's
  `setChatStreamScenario({ tokens, flag })`. Everything else in the chat page still goes through
  real-router + PGlite. Document this split in `apps/sprout/CLAUDE.md`.

### 5.5 Pipeline service (D7) — port with minimal change

The pipeline is the highest-value, lowest-churn part.

- **Location:** `apps/sprout-pipeline/`. **Port the HTTP layer from Hono to bare Fastify** — only
  `index.ts` is framework-coupled (routing, SSE out, the `x-pipeline-key` check); the safety modules
  are framework-agnostic and move untouched. It does **not** use `createAppServer` (no SPA), does
  **not** get a Store or PGlite (owns no DB — unchanged).
- **Port as-is:** all safety modules (`blocklist`, `canonicalise`, `crescendo`, `opinion-vote`,
  `prompt-injection`, `context-anchoring`, `validation`, `safety-classifier`, `sensitive-topics`,
  `depth-tracking`, `lexical-classifier`, `prompt`, `flag-and-forward`) and their **13 vitest
  suites** + the `eval/` ratchet. These are pure functions — they move unchanged except import-path
  hygiene (5.7).
- **DI improvement:** inject the `OpenAI`/OpenRouter client rather than constructing it at module
  scope, so `index.ts` orchestration is testable (addresses the "orchestrator has no tests" gap in
  review issue #4 / part B; add the integration test there).
- **Also apply the review fixes here** while touching the file (issue #4 part A): run
  `detectSensitiveTopics` and `checkConversationDepth` on the **canonicalised** scan copy.
- **Adopt shared plumbing:** `@hoe/config` (lint/tsconfig/prettier), `@hoe/logger`. Not
  `@hoe/backend-kit` (headless).
- **Transport:** REST + SSE on Fastify (`reply.raw` with `text/event-stream` for the token/flag
  stream). Bind to the private network. Keep `x-pipeline-key`.

### 5.6 Shared package

- `packages/shared` (types, presets, calibration) → these are cross-cutting domain constants used
  by **both** apps. HomeOfEd's rule: shared code lives in `packages/*` (no app→app imports). So
  create `packages/sprout-shared` (or fold into an app if only one uses each — but presets/calibration
  are used by both web and pipeline, so a package is correct).
- Alternatively, since only two sibling apps of one product use it, a small `packages/sprout-shared`
  is the leaf-node-compliant home. Zero runtime deps (TypeScript only) — trivial to port.

### 5.7 Tooling & code conformance (applies to every file moved)

HomeOfEd's shared config is stricter than child-safe-llm's. Every ported file must satisfy:

- **`verbatimModuleSyntax`** → all type-only imports become `import type`.
- **`allowImportingTsExtensions`** → imports carry explicit `.ts`/`.tsx` (e.g. `from './store.ts'`).
- **`typescript-eslint` recommendedTypeChecked** → no floating promises (`await`/`void`), no
  `no-unsafe-*` (no untyped `any` flows), no `no-explicit-any`, `require-await`, etc.
- **Prettier**: no semicolons, single quotes, printWidth 100. (child-safe-llm currently uses
  semicolons — a repo-wide reformat.)
- **Consume shared config**: `tsconfig.json extends "@hoe/config/tsconfig.base.json"`;
  `eslint.config.js` re-exports `baseConfig`; `"prettier": "@hoe/config/prettier"`. Delete the old
  `eslint.config.js`, `.prettierrc`, `tsconfig.base.json`.
- **No arrow-only or cross-app-import lint rule exists** — those are convention + review. (Your own
  global preference is arrow-only anyway; the code already complies.)

### 5.8 Dependency & toolchain reconciliation

| Concern | child-safe-llm | HomeOfEd | Action |
|---|---|---|---|
| Node | `>=20` (`node:20-alpine`) | **22** (`node:22-slim`, `.nvmrc`) | Bump to 22 |
| pnpm | `10.32.1` | **9.15.9** (`packageManager` + corepack) | Align to 9.15.9 |
| Task runner | none (`pnpm -r`) | **Turborepo** | Adopt turbo (tasks: build/dev/lint/typecheck/test) |
| TypeScript | `^6.0.2` | `^5.9.3` | Align to repo config version |
| React | `^19.2.5` | 19 | ✓ |
| TanStack Router/Query | Router 1.168 / Query 5.99 | Router 1.x / Query 5.x | ✓ (drop Start) |
| tRPC | none | **v11** | Add |
| Drizzle / drizzle-kit | 0.45.2 / 0.31.10 | 0.45.2 / 0.31.10 | ✓ (identical) |
| DB driver | `postgres` (postgres-js) | `@hoe/db` factory (node-postgres ↔ PGlite) | Swap to `@hoe/db` |
| Migrations | `drizzle-kit push` (no files) | **generate + journal migrate** | Convert |
| Styling | Tailwind v4 + shadcn | **SCSS modules** | Rewrite (D1) |
| Test backend | hand-rolled in-memory BackendSimulator | **real router + PGlite** | Replace |
| Vitest / Playwright CT | 4.1.4 / 1.59.1 | pinned (CT 1.61.1) | Align to repo pins |

---

## 6. Database migration detail

1. **One schema:** move the 9 app tables (`packages/db/src/schema/*`) + the 4 Better Auth tables
   into `apps/sprout/src/server/schema.ts`. Export `sproutSchema` + `type SproutSchema`.
2. **`drizzle.config.ts`:** copy `apps/hub`'s (dialect postgresql, `schema: ./src/server/schema.ts`,
   `out: ./src/server/migrations`). Delete both old configs and the `tablesFilter` split.
3. **Driver swap:** all DB access goes through `@hoe/db`'s `createDbClient` (Postgres in `main.ts`,
   PGlite in `simulator.ts`/tests). Delete the direct `postgres`/`getDb()` construction in
   `api-handlers.ts` and `auth.ts` — the Store gets the injected `DbClient`.
4. **Generate the first migration:** `pnpm --filter sprout generate` → commit
   `src/server/migrations/*.sql` + `meta/` (incl. `_journal.json`). This replaces the whole
   `db:push` workflow (which the current `fly.toml` runs as `release_command = pnpm db:push:ci` — a
   `drizzle-kit push` that needs a TTY and is CI-fragile, per the source CLAUDE.md).
5. **Loaders:** `migrations.ts` (Vite `?raw` glob, verbatim from hub) and `migrate.ts` (release
   entrypoint, `migratePostgres`).
6. **Store:** `SproutStore` interface (the full server-side query surface, incl. `ping()` for deep
   health) + `DrizzleSproutStore`. This is where the ~30 endpoints' queries land.
7. **PGlite feature check:** the app uses JSON(B) columns (`flags.topics`, preset payloads),
   composite indexes (`behavioural_events`), unique constraints, cascades. Confirm these on PGlite
   (ADR 0001 §5 keeps an evidence list; the CI real-Postgres job covers gaps). Add
   `testTimeout: 30_000` for PGlite WASM boot.
8. **MPG (D10):** hand off to provision **Managed** Fly Postgres for this app (backups/replication),
   not the shared unmanaged `hoe-pg`, per ADR 0005's stated trigger.

---

## 7. Testing migration

**Delete** the hand-rolled BackendSimulator scaffolding (`src/test/backend-simulator/*`:
`BackendSimulatorDb`, `RouteHandlers`, `Route`, `Endpoint`, `EndpointBehaviourManager` — ~1,400
lines). It reimplements server logic; the HomeOfEd harness runs the **real router over PGlite**
instead, deleting the drift risk. This is exactly the improvement the genio reference doc predicts.

**Per app, build the three-file harness** (`templates/starter` / `apps/fridge` pattern):

- `src/testing/IwftApp.tsx` — `exposeDispatcher(...)` over `createDispatcher({ router: appRouter,
  createContext: createContext({ store: new DrizzleSproutStore(await applyPendingSeed(await
  freshTestDb(sproutSchema, migrations))), blobs: new InMemoryBlobStore(), logger, auth:
  testUserAuth }) })`.
- `src/testing/iwftTest.tsx` — `createIwftTest({ harness: <IwftApp/>, createRoot: p => new
  XPagePom(p) })`.
- `src/testing/*PagePom.ts` — Page Object Models (all locators/`expect`s live here; specs stay thin).

**Rewrite the 10 `.iwft.tsx` flows** (`chat-experience`, `child-flows`, `conversation-lifecycle`,
`parent-*`, `pipeline-guardrails`) onto `mountApp({ seed, user, failures })`:

- Seed via `mountApp({ seed: async db => db.execute('insert …') })` (self-contained raw SQL).
- Auth via `mountApp({ user: { id, role } })` → `x-hoe-test-user` header → `ctx.auth`.
- Failure injection via `mountApp({ failures: [{ path, mode }] })`.
- Chat streaming stays a `page.route` SSE simulator (5.4).

**Keep as-is:** the pipeline's 13 vitest suites + eval ratchet (pure functions). **Add:** the
`index.test.ts` orchestrator integration test (review issue #4B) now that the OpenAI client is
injectable. **Port:** the web app's 2 vitest unit tests (`password`, `behavioural-limits`) — these
move unchanged; handler unit tests get the `FakeSproutStore` + `makeCtx` pattern.

**Guidance (HomeOfEd):** keep `.iwft` thin; push assertion volume to the fast vitest layer.

---

## 8. Styling migration (D1) — Tailwind → SCSS modules

The heaviest pure-UI item. Scope: single `styles.css` (Tailwind theme + tokens), ~19 components,
7 shadcn primitives, `cva`/`clsx`/`tailwind-merge` utilities.

- Establish design tokens as SCSS variables/custom properties (port the `@theme` custom properties
  from `styles.css`).
- Each component gets a co-located `X.module.scss`; replace `className="…tailwind…"` +
  `cva`/`clsx`/`tailwind-merge` with `styles.x` composition.
- The **shadcn primitives** (`button`, `card`, `input`, `label`, `slider`, `switch`, `textarea`)
  need reimplementation as plain styled components — they are Tailwind-class-driven today. This is
  the bulk of the effort. Consider `@base-ui/react` (already a dependency) for unstyled primitive
  behaviour + your own SCSS, keeping accessibility.
- Remove `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `shadcn`, `class-variance-authority`,
  `tailwind-merge`, `components.json` from the app.
- Re-test every screen visually. This is the one workstream with no test-driven safety net beyond
  the `.iwft` behavioural checks.

> If this effort proves disproportionate mid-migration, D1 is the most reasonable decision to
> revisit — Tailwind-as-app-local-choice is defensible under "each app owns its styles." Flagged so
> you can change course without unpicking the rest.

---

## 9. Deployment & infrastructure

### 9.1 Two apps, the standard recipe (per app)

Follow `docs/how-to/adding-an-app.md`. For **`sprout`** (DB-backed) run §1 + §2; for
**`sprout-pipeline`** run §1 only (stateless) but with a headless variant (no SPA, no `createAppServer`).

- **Dockerfile:** 4-stage `turbo prune` build (copy `apps/hub/Dockerfile`). For `sprout`: add
  `@hoe/db` to prod-deps filter, `COPY packages/db`, and `rm -rf …pglite…` (must not ship PGlite).
  For `sprout-pipeline`: a simpler image (Hono server, its deps, no `@hoe/db`, no SPA `dist`).
- **fly.toml:** `app = 'hoe-sprout'` / `'hoe-sprout-pipeline'`, `primary_region = 'lhr'`,
  `internal_port = 8080`. `sprout` gets `[deploy] release_command = 'node src/server/migrate.ts'` +
  deep `/health`; **plus `[processes] web + worker`** (D8) — `web = node src/server/main.ts`,
  `worker = node src/server/worker.ts`. `sprout-pipeline` gets a shallow `/health`, no
  `release_command`, and is **not** exposed publicly (private-network service; drop the public
  `http_service` or restrict it).
- **compose.yml:** add `sprout` (two-service: migrate-then-serve + its own `postgres:17` + volume),
  `sprout-worker` if you want local parity of the process split, and `sprout-pipeline` (single
  service). Fresh unique host ports.
- **CI (`.github/workflows/deploy.yml`):** copy the `deploy-hub` job twice → `deploy-sprout`,
  `deploy-sprout-pipeline` (each: affected check `select(.name=="…")`, fly.toml path, smoke URL).
  Deploy order: pipeline first (web depends on it at runtime), or independent with retry on the web
  smoke.
- **Ports:** allocate the next free dev/CT pairs (in use: hub 3000/3100, starter 3001/3101, fridge
  ?/3103). Pick e.g. sprout 3004/3104, pipeline dev port 3005 (no CT).

### 9.2 The retention/purge worker (D8) — net-new pattern

- `src/server/worker.ts` — a long-running process that periodically (a) summarises + purges
  conversations past the retention window (the existing summarise-through-pipeline flow, now
  server-driven), and (b) prunes `behavioural_events` past their window. Uses the same injected
  `Store` + a pipeline call for summarisation.
- Runs as the `worker` process group in `hoe-sprout` (shares the image, separate process). ADR 0001
  §3 sanctions this; there is no prior example, so write the ADR and keep it minimal (an internal
  timer loop or Fly scheduled machine — decide in the ADR; a simple `setInterval` loop in a
  min-1-machine process is the least-moving-parts option).

### 9.3 Human-gated infra (hand off, do not run)

Per HomeOfEd CLAUDE.md, an agent never creates/mutates real infra. Hand a human:

- `fly apps create hoe-sprout` and `hoe-sprout-pipeline`.
- **Managed** Postgres for sprout (D10) + attach → sets `DATABASE_URL` secret.
- Secrets: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PIPELINE_API_KEY`, `OPENROUTER_API_KEY`, the
  child-session signing secret. (Set on the right app: OpenRouter + pipeline key on the pipeline;
  auth secrets on web.)
- Private networking: confirm web reaches `hoe-sprout-pipeline.flycast`.
- Cloudflare: proxied CNAME `sprout → hoe-sprout.fly.dev`, Full (strict) TLS, Fly cert. Pipeline
  gets **no** public hostname.
- The repo has `scripts/go-live.sh <app> [--db]` (ADR 0011) that scripts most of this.

---

## 10. Compliance & residency notes

- **Residency:** Fly LHR satisfies the UK-only requirement the app documents. Keep both apps and the
  DB in `lhr`. No non-UK region, no cross-region replicas without a DPIA update.
- **MPG (D10):** move to Managed Postgres for backups/PITR — appropriate for data with this
  sensitivity, and the documented ADR 0005 trigger.
- **Data retention:** the worker (9.2) enforces the retention/purge policy the compliance docs
  assume. This must be working before launch, not after.
- **Port the safeguarding runbook:** `docs/safeguarding/csam-grooming-escalation.md` and the
  launch-readiness gate move into the sprout app docs. These are launch-blocking and must not be
  lost in the migration.
- **Secret isolation:** the pipeline-as-separate-app + private networking is the platform's own
  recommendation for this app's attack surface. LLM keys live only on the pipeline.

---

## 11. Phased plan (with verify gates)

Each phase ends green on `pnpm --filter <app> lint && typecheck && test && build`. Order respects
dependencies; several phases can overlap once P1–P3 land.

**P0 — Scaffold (both apps).** `cp -r templates/starter apps/sprout`; create `apps/sprout-pipeline`;
rename touchpoints; adopt turbo/pnpm/node pins; wire `@hoe/config`. *Verify:* the starter greeting
demo passes in `apps/sprout`; both apps lint/typecheck/build green (empty pipeline).

**P1 — Database.** Merge schemas (app + auth) into `schema.ts`; `@hoe/db` driver; `generate` first
migration; `store.ts` (`SproutStore` + `DrizzleSproutStore`) with the full query surface;
`store.test.ts` over PGlite. *Verify:* `store.test` green on PGlite; migration applies in
docker-stack.

**P2 — Auth.** Better Auth config against the injected client; parent + child `AuthProvider`s;
signed child session token (kills #34's unsigned localStorage); mount `/api/auth/*`. *Verify:*
handler unit tests for auth; an `.iwft` login flow.

**P3 — tRPC backend.** Convert every endpoint (5.1 checklist) to Handler + procedure with ownership
checks (resolves #35/#36); DI the Store through router/`main.ts`/`simulator.ts`/`IwftApp.tsx`.
*Verify:* handler unit tests (FakeSproutStore); cross-family access returns 403 in tests.

**P4 — Frontend SPA.** Drop TanStack Start; SPA entry; tRPC client + `features/*` Query factories;
port routes/components (behaviour only, styling in P7). *Verify:* app runs in dev simulator mode;
`.iwft` flows for non-chat screens pass.

**P5 — Streaming.** `createAppServer` route hook (D9); SSE route (`chat-sse.ts`); port + fix
`useChat.ts`; `page.route` SSE simulator for tests. *Verify:* chat `.iwft` passes; manual
end-to-end token stream in docker-stack against the pipeline.

**P6 — Pipeline.** Port `apps/sprout-pipeline` (logic + 13 vitest + eval); **port the HTTP layer from
Hono to bare Fastify**; DI the OpenAI client; add `index.test.ts`; apply review #4A canonicalisation
fix; private-network binding. *Verify:* vitest + eval ratchet green; orchestrator integration test
green (also covers the new Fastify routing / SSE / `x-pipeline-key` auth).

**P7 — Styling.** Tailwind → SCSS modules (5.8 / §8). *Verify:* every screen visually re-checked;
`.iwft` flows still green.

**P8 — Deploy config.** Dockerfiles, fly.toml (incl. `[processes]` worker), compose, CI jobs.
*Verify:* `docker compose up sprout` serves deep `/health`; prod smoke locally; pipeline image runs.

**P9 — Worker + retention.** `worker.ts`; retention/purge; behavioural-events pruning. *Verify:*
worker runs in docker-stack; retention integration test.

**P10 — Docs & ADRs.** Author D5/D7/D8/D9 ADRs + kit/app CLAUDE.md; port safeguarding + launch-
readiness docs; retire stale source docs (the drift issue #8: `docs/architecture/00-tech-stack.md`
still names Vercel/Cloudflare). *Verify:* docs review; the "adding an app" checklist is satisfied.

**P11 — Human go-live.** Hand off §9.3 (infra, MPG, secrets, Cloudflare, private networking).

---

## 12. Risks & watch-items

| Risk | Mitigation |
|---|---|
| **SSE is net-new in the repo** — no precedent, kit change required | Keep it a plain Fastify route (D3), minimal kit hook (D9); prototype the SSE route early (P5) before committing the full frontend. |
| **PGlite vs Postgres gaps** (JSONB, composite indexes, cascades) | HomeOfEd's per-PR real-Postgres CI job + docker-stack; verify the specific features in P1. |
| **Styling rewrite has no automated safety net** | `.iwft` covers behaviour; visual re-test per screen; D1 is the flagged fallback if effort balloons. |
| **Better Auth diverges from the repo's auth direction** | ADR D5 records it as an explicit, bounded V1 choice; the `ctx.auth` seam means a future central-auth swap touches only the provider. |
| **Worker pattern is unprecedented** | Keep it minimal (D8 ADR); a timer loop in a min-1 process, not a bespoke scheduler. |
| **Two-app deploy ordering** (web needs pipeline at runtime) | Deploy pipeline first; web `/health` stays shallow-independent of pipeline; chat degrades gracefully if pipeline is down (fail-closed to a safe fallback, which the pipeline design already does). |
| **Scope creep** — this touches every layer | The phase gates keep each step green; the pipeline (highest value) changes least; resist "improve while I'm here" beyond the four review fixes already folded in. |

---

## 13. What ports with least change (do these confidently)

- The **entire safety pipeline logic** + its 13 vitest suites + eval ratchet.
- `packages/shared` (types/presets/calibration) → `packages/sprout-shared`.
- The **Drizzle schema shapes** (only the config/driver/migration mechanism changes, not the tables).
- The **domain error semantics** map cleanly onto the kit's `DomainError` taxonomy.
- `password.ts` (scrypt) and `behavioural-limits.ts` + their vitest tests.

## 14. What needs the most thought (design before coding)

- The SSE route + kit hook (P5) — prototype first.
- Child-session signing + the two-provider `ctx.auth` model (P2).
- The retention worker scheduling mechanism (P9 / D8 ADR).
- The shadcn-primitive reimplementation in SCSS (P7).

---

## Appendix A — ADRs to author (in HomeOfEd `docs/adr/`)

1. **sprout brings its own auth provider (Better Auth) for V1** (D5) — why per-app auth is accepted
   now, how it sits behind `ctx.auth`, and the migration path to central auth.
2. **Headless service app shape** (D7) — a deployable app with no SPA (the pipeline); what rules
   apply (layered/DI, config/logger, **bare Fastify** for the HTTP layer) and which don't
   (`createAppServer`, Store, PGlite). Record the **future upgrade path**: when a second headless
   service exists, extract a shared `createServiceServer` (bare Fastify: health + logger + routes, no
   static/SPA) into `backend-kit` and migrate both onto it — not before (one consumer doesn't justify
   the abstraction).
3. **First worker process / scheduled work** (D8) — the `[processes] web + worker` pattern and the
   scheduling mechanism chosen.
4. **`createAppServer` route-registration hook** (D9) — the additive kit change enabling SSE + the
   Better Auth handler beside tRPC.

## Appendix B — Source → destination file map (headline)

| Source (child-safe-llm) | Destination (HomeOfEd) | Transform |
|---|---|---|
| `apps/web/src/lib/auth-middleware.ts` | `apps/sprout/src/server/router.ts` + `handlers/*` | REST prefix router → tRPC + Handler classes |
| `apps/web/src/server/api-handlers.ts` | `apps/sprout/src/server/handlers/*` + `store.ts` | logic → handlers; queries → Store |
| `apps/web/src/api/*.ts`, `src/queries/*.ts` | `apps/sprout/src/features/*` | fetch clients → tRPC client + Query factories |
| `apps/web/src/lib/auth*.ts` + `auth-schema.ts` | `apps/sprout/src/server/auth/*` + `schema.ts` | merge schema; provider behind `ctx.auth` |
| `apps/web/src/hooks/useChat.ts` | `apps/sprout/src/features/chat/*` + `server/chat-sse.ts` | SPA client + SSE route; fix frame buffer |
| `apps/web/src/components/*` (Tailwind/shadcn) | `apps/sprout/src/components/*` (+ `*.module.scss`) | rewrite styling |
| `apps/web/src/routes/*` (Start) | `apps/sprout/src/routes/*` (SPA) | drop SSR |
| `apps/web/src/test/backend-simulator/*` | *(deleted)* | replaced by real-router + PGlite |
| `apps/web/src/test/flows/*.iwft.tsx` | `apps/sprout/src/*.iwft.tsx` + `testing/*` | rewrite onto `mountApp` |
| `apps/pipeline/src/*` | `apps/sprout-pipeline/src/*` | port; **Hono → bare Fastify**; DI OpenAI; canonicalise fix |
| `packages/db/src/schema/*` | `apps/sprout/src/server/schema.ts` | one schema, app-owned |
| `packages/shared/src/*` | `packages/sprout-shared/src/*` | port |
| `docs/safeguarding/*`, `launch-readiness.md` | `apps/sprout/` docs | carry over (launch-blocking) |
| `docs/architecture/00-tech-stack.md` (Vercel/Cloudflare) | *(retire / supersede)* | drift fix (issue #8) |
