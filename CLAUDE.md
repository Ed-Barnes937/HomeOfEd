# CLAUDE.md — working rules

App Hub: a personal production home on `homeofed.com` for independent, subdomain-
routed apps. Hosting: Fly.io (London) + Cloudflare. This file is the high-signal
rule set; rationale lives in [`docs/adr/`](docs/adr/) and procedures in
[`README.md`](README.md). Read [ADR 0001](docs/adr/0001-foundation.md) before
changing the foundation.

## Navigation

- `apps/*` — leaf-node apps; each owns its UI/styles, has a scoped `CLAUDE.md`.
- `packages/config` — tsconfig / eslint / prettier base.
- `packages/db` — Drizzle client, Postgres↔PGlite driver swap, migration runner.
- `packages/backend-kit` — handler base, transport adapters, `Store`/`BlobStore`
  interfaces, fakes, the **backendSimulator** harness, the prod `createAppServer`
  (Fastify) factory, DI.
- `packages/logger` — structured JSON logging.
- `packages/test-kit` — Playwright fixtures, base POM, iwft↔simulator glue.
- `docs/adr/*` — decisions. `docs/plans/*` — implementation plans.

When working inside a package or app, read its `README.md`/`CLAUDE.md` first.

## Hard rules

1. **Leaf nodes.** Apps may import from `packages/*`. **No app imports from
   another app.** Shared code goes in a package.
2. **No shared UI.** Each app owns its components and styles. Packages are
   plumbing only (config, db, backend-kit, logger, test-kit).
3. **Layered backend + DI in every app:** `transport (tRPC) → domain (handler
   classes) → Store/BlobStore interfaces`. Handlers depend on interfaces, never a
   concrete DB/blob impl. The **same handlers run in prod and in the simulator**.
4. **SPA by default; all data through tRPC.** New apps are SPAs (TanStack Router
   + Query + tRPC client) — see [ADR 0003](docs/adr/0003-spa-default-tanstack-start-opt-in.md).
   TanStack Start is opt-in only when SSR/SEO truly helps. Either way, **data
   goes through tRPC, never server functions** (they bypass the DI seam); the
   `Store`/`BlobStore` is injected into the one tRPC context.
5. **Fakes over mocks.** Model dependencies as classes behind interfaces and
   inject them. Prefer the PGlite / in-memory fakes; `page.route()`/MSW are a
   fallback, not the default — not banned.
6. **TDD.** Red → green → refactor. Tests are non-negotiable.
7. **Surgical changes.** Touch only what the task requires; match surrounding
   style; don't refactor unrelated code.

## Workflow

1. Write the failing test first (`*.test` for logic, `*.iwft` for whole-frontend).
2. Make it pass with the minimum code.
3. Refactor; keep it green.
4. Run the verify loop below.

## Verify before you finish

```bash
pnpm lint
pnpm typecheck
pnpm test --filter=<the package/app you touched>
```

- All three green.
- New/changed packages have a current `README.md`; apps have a scoped `CLAUDE.md`.
- Any decision you made is recorded in an ADR (`docs/adr/NNNN-title.md`, MADR-lite).
- You did **not** add cross-app imports, shared UI, or data-fetching server functions.

## Commands

```
pnpm dev --filter=<app>    # simulator mode: frontend + handlers + PGlite, HMR, no docker
docker compose up          # docker-stack: real Fly Dockerfiles + real Postgres
pnpm test  --filter=...    # vitest (*.test) + playwright (*.iwft)
pnpm lint | pnpm typecheck
```

## Infrastructure is human-gated

Do **not** run commands that create or mutate deployed infrastructure (`fly apps
create`, `fly postgres`, `fly mpg`, `fly secrets set`, `fly deploy`, Cloudflare
DNS/cert changes).
Stop and hand these to the human with the relevant runbook —
[docs/runbooks/phase-4-go-live.md](docs/runbooks/phase-4-go-live.md).
Writing Dockerfiles, `fly.toml`, compose files, and CI workflows is fine —
*applying* them to real infra is not.

## Adding an app

Full agent-followable procedure: **[docs/how-to/adding-an-app.md](docs/how-to/adding-an-app.md)**
(decide DB → create → add DB → verify → deploy). The checklist below is the
in-context summary.

Copy the minimal reference app, then change each wiring touchpoint. The copy base
is **`templates/starter`** — the stateless baseline
([ADR 0007](docs/adr/0007-reference-starter-app.md)); `hub` is the launcher, not
the copy base.

**Does it need a database?** Yes if data must survive restarts/redeploys, is
shared across sessions, or is queried server-side. No (stateless) if it's pure
compute, a proxy over external APIs, or client-only state. Auth does **not**
imply a DB (decentralised — [ADR 0008](docs/adr/0008-apps-without-a-database.md)).
Unsure → start stateless; a DB is additive.

Every app:

1. **App name** — `apps/<name>`, `package.json` name.
2. **Subdomain** — `<name>.homeofed.com` (apex `homeofed.com` = `hub`).
3. **Ports** — unique local dev port (`package.json` dev script) **and** CT
   port (`playwright-ct.config.ts` `ctPort`).
4. **Fly app** — `fly.toml` app name (human runs `fly apps create`).
5. **Cloudflare** — proxied CNAME `<name> → <flyapp>.fly.dev`, Full (strict) TLS,
   Fly cert (human-run).
6. **CI** — copy the `deploy-hub` job in `.github/workflows/deploy.yml`
   (app name in the affected check, fly.toml path, smoke URL).
7. **Docker stack** — copy the app service in `compose.yml` (fresh host port).

**Only if the app persists data** (skip for stateless apps —
[ADR 0008](docs/adr/0008-apps-without-a-database.md)):

8. **Postgres** — its own database in the shared `hoe-pg` cluster + connection
   secret (human runs `fly postgres attach` — see the runbook).
9. **DB wiring** — add the `@hoe/db` layer (schema, migrations, Store, `migrate.ts`),
   the `release_command` in `fly.toml`, and the app's DB service in `compose.yml`.
   A stateless app instead has a shallow `/health` (no `Store` round-trip).
   Full step-by-step: [the how-to §2](docs/how-to/adding-an-app.md#2-add-a-database-database-backed-apps-only).

Default to a **single container** (UI + API + streaming). Split to a separate Fly
app only for WebSockets / independent scaling / isolation; multi-process for
background work. See [ADR 0001 §3](docs/adr/0001-foundation.md).
