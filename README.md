# App Hub

A personal production home on `homeofed.com` for a range of independent apps —
gimmick apps, larger apps, possibly a blog. Each app is self-contained and routed
by subdomain (`app.homeofed.com`). Hosting is Fly.io (London) + Cloudflare.

> **Status:** live — <https://homeofed.com> (since 2026-07-02). The foundation
> was built from the
> [implementation plan](docs/plans/0001-foundation-implementation-plan.md).

Decisions and their rationale live in [`docs/adr/`](docs/adr/). The architecture
baseline is [ADR 0001](docs/adr/0001-foundation.md); hosting is
[`docs/hosting.md`](docs/hosting.md).

## Tech stack

- **Frontend:** React SPA — TanStack Router + TanStack Query + tRPC client, SCSS modules. TanStack Start (SSR) is opt-in per app ([ADR 0003](docs/adr/0003-spa-default-tanstack-start-opt-in.md)).
- **Backend:** TypeScript, layered + dependency injection, tRPC preferred (REST where it fits).
- **Database:** Drizzle on Fly Postgres (LHR, unmanaged — [ADR 0005](docs/adr/0005-unmanaged-fly-postgres.md)); PGlite as the in-memory fake.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Tests:** Vitest (unit) + Playwright (isolated whole-frontend).

## Repository structure

```
apps/*            leaf-node apps; own their UI/styles. hub = landing + reference app.
packages/
  config          tsconfig / eslint / prettier base
  db              drizzle client, Postgres↔PGlite driver swap, migration runner
  backend-kit     handler base, transport adapters, Store/BlobStore interfaces,
                  fakes, the backendSimulator harness, DI
  logger          structured JSON logging
  test-kit        playwright fixtures, base Page Object Model, iwft↔simulator glue
docs/
  adr/            numbered MADR-lite decision records
  plans/          implementation plans
  reference/      background studies (e.g. the backend-simulator pattern)
  hosting.md      hosting & infrastructure decision
CLAUDE.md         agent + contributor working rules
```

Every package ships its own `README.md` (purpose, public API, usage, testing).
Every app ships a scoped `CLAUDE.md` and a `README.md`.

## Getting started

**Prerequisites:** Node (see `.nvmrc`), pnpm (via `corepack enable`), Docker
(for docker-stack mode), and the Fly CLI (`flyctl`) for deploys.

```bash
corepack enable
pnpm install
```

## Standard procedures

### Run locally — two modes

| Mode | Command | What runs |
|---|---|---|
| **Simulator** (daily driver) | `pnpm dev --filter=<app>` | Frontend + real handlers + **PGlite** + in-memory blob. HMR, no Docker, no DB server. Same backend the `.iwft` tests use. |
| **Docker stack** (parity / integration) | `docker compose up` | The **actual Fly Dockerfiles** + a real Postgres container. Verifies the real artifact, transport, networking, env/secrets, migrations. |

Simulator mode is for almost all work. Use docker-stack to verify the real
artifact before a deploy and to catch any PGlite-vs-Postgres gaps.

#### Docker stack

```bash
docker compose up hub       # one app + its DB (depends_on starts hub-db)
docker compose up           # everything
```

Builds each app's real Fly Dockerfile (from the repo root — turbo-pruned,
prod-deps-only, no pglite/test code) and runs it against a `postgres:17`
service. The app container runs the same two steps as a Fly deploy: the
journal-tracked migrate entrypoint (`release_command` locally), then the
server. Hub: <http://localhost:8080>, deep health at `/health`. Local DB
credentials are hardcoded in `compose.yml`; anything genuinely secret belongs
in a gitignored `.env` via `env_file`, never in the file.

### Test, lint, typecheck

```bash
pnpm test --filter=<app|pkg>      # vitest (*.test) + playwright iwft (*.iwft)
pnpm lint
pnpm typecheck
```

Test layers: `*.test.ts(x)` (Vitest unit/integration), `*.iwft.ts(x)` (Playwright
whole-frontend, POM-driven, simulator-backed), `*.e2e.ts(x)` (full stack —
deferred). TDD red → green → refactor.

### Add an app

No generator — **copy `apps/hub`** and change each wiring touchpoint. See the
checklist in [`CLAUDE.md`](CLAUDE.md) and [ADR 0001 §11](docs/adr/0001-foundation.md).

### Deploy

CI deploys changed apps to Fly on merge to `main` (migrations via `fly.toml`
`release_command`, then a `/health` smoke check). Initial infrastructure setup
(Fly apps, Postgres, Cloudflare DNS, GitHub secrets) is done by a human
following [docs/runbooks/phase-4-go-live.md](docs/runbooks/phase-4-go-live.md).

## Documentation map

| Doc | Purpose |
|---|---|
| `README.md` | This file — overview + standard procedures. |
| `CLAUDE.md` | Working rules for agents/contributors; the "adding an app" checklist. |
| `docs/adr/*` | Numbered decision records (rationale). |
| `docs/plans/*` | Implementation plans. |
| `docs/reference/*` | Background studies informing decisions (e.g. the backend-simulator pattern). |
| `docs/hosting.md` | Hosting & infrastructure decision. |
| `packages/*/README.md` | Per-package purpose, API, usage. |
| `apps/*/CLAUDE.md` | Per-app specifics. |
