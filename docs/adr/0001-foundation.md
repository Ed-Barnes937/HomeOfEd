# 0001 — App Hub foundation

- **Status:** Accepted
- **Date:** 2026-06-29
- **Supersedes:** none
- **Related:** [hosting.md](../hosting.md)

## Context

App Hub is a personal production home on `homeofed.com` for a range of
independent apps (gimmick apps, larger apps, possibly a blog). Hosting is
already decided — Fly.io (London) for compute, Cloudflare for DNS/CDN, one
Docker container per app (see [hosting.md](../hosting.md)). This ADR decides the
**repository foundation**: how the monorepo is structured, how apps are built,
tested, run locally, and shipped — so new apps can be added rapidly on a solid
base. It does **not** decide anything about the apps themselves.

Stated constraints that shaped the decisions:

- React frontends, SCSS modules. **SPA by default** (TanStack Router + Query);
  TanStack Start is opt-in per app — see [ADR 0003](0003-spa-default-tanstack-start-opt-in.md).
- TypeScript backends; tRPC preferred, REST where it fits better.
- Multi-package monorepo with clear module boundaries.
- Tests are non-negotiable; agentic coding uses TDD red/green.
- Documentation discipline kept as we go (ADRs, scoped `CLAUDE.md`, READMEs).
- Each app is a **leaf node** — no app depends on another app — and is
  individually runnable, routed by subdomain (`app.homeofed.com`).

## Decisions

### 1. Monorepo tooling — pnpm + Turborepo

pnpm workspaces for linking and installs; Turborepo for the task graph, caching,
and `--filter`/affected-only runs. Lightest path to "build/test/deploy only what
changed" in CI. No Nx.

### 2. Module boundaries — share plumbing, not UI

- Apps live in `apps/*`, shared libraries in `packages/*`.
- Apps may depend on `packages/*`; **apps never depend on other apps** (leaf
  nodes — no incoming edges from siblings).
- Shared packages cover **plumbing only**: config, database, backend kit,
  logging, test kit. **No shared UI/design-system** — each app owns its own
  components and styles, for visual freedom and independence.
- The leaf-node rule is enforced by **convention + code review**, documented in
  `CLAUDE.md` — not by an ESLint boundary rule (revisit if it's violated in
  practice).

### 3. Deploy unit — one container per app, escalate by trigger

Default: each app is a **single container** serving the static SPA + its
tRPC/REST API + streaming on one Node process — the shared **Fastify**
`createAppServer` factory in `packages/backend-kit` serves the built SPA bundle
(`@fastify/static`, with SPA fallback) and mounts the tRPC handler; each app's
thin entrypoint calls it with its router + real `Store` + `staticDir` (a TanStack
Start opt-in app serves its Nitro server instead). WebSockets, when an app
escalates to them, use `@fastify/websocket`. This is the cheapest, simplest shape
on Fly and matches `hosting.md`. **Streaming/SSE stays in the single container** —
it does not force a split.

Escalate beyond one container only when a trigger is hit:

| Trigger | Resolution |
|---|---|
| **WebSockets** | Separate Fly app (web deploys must not drop live sockets). Most common trigger. |
| **Independent scaling / heavy CPU or memory** | Separate Fly app (don't let one tier starve the other). |
| **Restart isolation for long work** | Separate Fly app. |
| **Background / scheduled work** | **Multi-process, same Fly app** (`[processes] web + worker`) — not a separate app. |
| **Secret / attack-surface isolation** (e.g. the child-safe LLM app) | Separate Fly app. |
| **Non-Node runtime** | Separate Fly app. |

Two flavours of "split": **multi-process within one Fly app** (background work,
no independent deploy needed) vs **separate Fly app** (WebSockets, independent
scaling, isolation).

### 4. Backend architecture — layered + dependency injection (every app)

This is the keystone that makes the simulator and isolated frontend tests work.
Every app's backend is layered:

```
transport      tRPC / REST adapter — thin; calls handlers
   ↓
domain         route-handler CLASSES — business logic; depend on interfaces only
   ↓
persistence    Store + BlobStore INTERFACES
                 production → real impls (Drizzle/Postgres, Tigris object storage)
                 simulator  → fake impls  (PGlite, in-memory blob)
```

The **same handler classes** run in production and in the simulator; only the
injected `Store`/`BlobStore` implementation changes. This is a hard convention —
trivial apps adopt it too, so any app can use standalone-run and `.iwft` tests.

**All data access goes through the tRPC router — one DI path.** With the SPA
default ([ADR 0003](0003-spa-default-tanstack-start-opt-in.md)) the browser
calls tRPC and there are no server functions. The `Store`/`BlobStore` is injected
into the single tRPC context, so dev, prod, and the simulator share one path. An
app that opts into TanStack Start must still route data through tRPC — **not**
through server functions (which bypass the tRPC DI seam).

The tRPC context also carries two small **injected seams**, frozen with the rest
of the contract so apps don't churn the context shape later:

- **Auth:** `ctx.auth.getUser(): User | null`, where `User = { id: string }`
  (apps extend it). `hub` and anonymous apps inject a provider returning `null`;
  `.iwft` tests inject a fixed test user; a real authed app plugs in its
  session/JWT provider. This freezes only the *injection point*, not an auth
  design.
- **Clock:** `ctx.now(): Date`, injected so tests can pin time.

### 5. Fakes over mocks — the backendSimulator

Dependencies are modelled as **classes behind interfaces and injected**, and
**fakes are strongly preferred over request mocks**. `page.route()`/MSW are
**not banned** — they are a fallback transport, not the default. The
backendSimulator is a faithful, reused fake (real handlers, fake persistence),
not per-test canned responses.

The **backendSimulator** is the real backend with persistence swapped for fakes:

- **Database fake = PGlite** (WASM Postgres). The same Drizzle schema, queries,
  and handlers run unchanged; only the driver swaps (real Postgres ↔ PGlite).
  Real SQL fidelity (constraints, transactions), no second store implementation
  to maintain, no Docker needed for the fake.
- **Blob fake = in-memory** implementation of the `BlobStore` interface (real
  impl = Tigris, Fly's S3-compatible object storage). The `BlobStore`
  **interface** is frozen with the rest of the contract and the in-memory fake is
  built in the foundation, but the **real Tigris impl is deferred** until an app
  actually stores a blob (`hub` does not) — same staged treatment as the REST
  adapter, to avoid speculative code.

**Same real router + PGlite, two transports** (SPA default — see
[ADR 0003](0003-spa-default-tanstack-start-opt-in.md)):

1. **Dev simulator mode** (`turbo dev`) → the SPA runs on the Vite dev server;
   tRPC calls hit a **Vite dev-server middleware** running the real router with
   PGlite (Node-side) injected. No Docker, no real DB.
2. **`.iwft` tests** → Playwright **Component Testing** mounts the SPA; tRPC HTTP
   is intercepted with `page.route` and dispatched to the **real router with
   PGlite (WASM) injected, in-browser**. No server process, no ports.

Both reuse the same router + `Store` injection; only the transport differs (Vite
middleware vs `page.route`). IWFT adds a **test-only layer** (seeding, fresh
in-browser PGlite per test, failure injection via a test-only tRPC link, fixed
clock, a test-auth seam) that dev mode does not load. Test-only code and `pglite`
must be kept out of the production image. (A TanStack Start opt-in app needs the
heavier full-server harness — deferred until the first such app.)

### 6. ORM + database — Drizzle on Fly Managed Postgres

- **Drizzle** ORM (implied by the PGlite driver-swap decision — one schema, two
  drivers).
- **Fly Managed Postgres (LHR)** in production: keeps data in-region (residency
  for the child-safe app) and inside Fly (one network, simplest compliance
  story). One **database per app** for isolation.

### 7. Database packaging

- `packages/db` — Drizzle client factory + **driver swap** (Postgres ↔ PGlite) +
  shared migration runner.
- Each app **owns its own schema + queries + real Store impl**.

### 8. Shared packages (initial set)

| Package | Responsibility |
|---|---|
| `packages/config` | Base `tsconfig`, ESLint flat config, Prettier. |
| `packages/db` | Drizzle client factory, PG↔PGlite driver swap, migration runner. |
| `packages/backend-kit` | Base handler class, tRPC router/transport, `Store`/`BlobStore` interfaces, in-memory/PGlite fakes, the **router+PGlite wiring** reused by dev (Vite middleware) and IWFT (in-browser), the prod **`createAppServer`** (Fastify) factory, the test-only failure-injection tRPC link, DI wiring. |
| `packages/logger` | Structured JSON logging. |
| `packages/test-kit` | Playwright **Component Testing** fixtures + the `page.route`→real-router-over-PGlite dispatch helper, base Page Object Model, fresh-PGlite-per-test reset, seed/failure-injection helpers. |

Exact split is the initial intent and may be refined during implementation.

### 9. Routing — per-app Fly app + Cloudflare subdomain

- Each app = its own Fly app, with a **Cloudflare proxied CNAME**
  `app.homeofed.com → <flyapp>.fly.dev`. Apex `homeofed.com` → the `hub` app.
- TLS: Cloudflare **Full (strict)** + a Fly-issued cert for the custom hostname.

### 10. Tracer bullet — `apps/hub`

The first build is a deliberately trivial landing app at `homeofed.com`: one page
+ one `trpc.health()` call that reads from Postgres. It exists to prove the whole
pipeline end-to-end (monorepo → tRPC → Postgres → Dockerfile → Fly → Cloudflare →
CI) and doubles as the **reference app** that new apps are copied from. As the
site's landing page it is also where navigation out to the other apps will live.
(Named `hub` rather than `www` — there is no `www.` subdomain; it serves the
apex.)

### 11. Adding an app — copy, no generator

No code generator and no separate `_template`. A new app is **copied from
`hub`**, guided by an "adding an app" checklist in `CLAUDE.md`. Revisit a
generator only if copying becomes a real chore.

### 12. Local dev — two run modes

| Mode | Command (shape) | What runs |
|---|---|---|
| **Simulator** (daily driver, per app, no Docker) | `turbo dev --filter=<app>` | Frontend + real handlers + **PGlite** + in-memory blob (HMR, fast). Same backend the `.iwft` tests use. |
| **Docker stack** (parity / integration) | `docker compose up` | The **actual Fly Dockerfiles** + a real Postgres container. Verifies the real artifact, transport, networking, env/secrets, migrations. Filterable to one app + its DB. |

The choice of real-PG vs PGlite is purely **which Store impl is injected** —
handler code is identical. Docker-stack mode is for *verifying* the real thing,
not an HMR inner loop. There is no separate "native HMR + Dockerized Postgres"
mode — PGlite covers the inner loop.

### 13. Testing — three layers, fakes over mocks

| Layer | Extension | Runner | Scope | Backend |
|---|---|---|---|---|
| Unit / integration | `*.test.ts(x)` | Vitest | logic, hooks, handlers, small components | fakes, injected (api-class / Store fakes) |
| **Isolated whole-frontend** | `*.iwft.ts(x)` | Playwright **Component Testing** (mount SPA; `page.route` → real router over in-browser PGlite) | a whole page/route, **POM**-driven | **backendSimulator** (real router + PGlite-WASM + in-memory blob) |
| E2E | `*.e2e.ts(x)` | Playwright | full stack, real backend | **deferred** |

- IWFT is **Playwright Component Testing** mounting the SPA, with tRPC calls
  served in-browser by the real router over PGlite — **no server boot**. (A
  TanStack Start opt-in app needs the heavier full-server harness; deferred.)
- **Keep IWFT thin.** Push assertion volume to the fast Vitest layer (which pins
  backend/handler behaviour independently) and reserve IWFT for whole-page
  behaviour. This also offsets the coupling of frontend tests to backend
  correctness.
- **Per-test isolation:** a fresh in-browser PGlite per test (WASM loads once per
  worker); migrate at instance creation.
- E2E is deferred; deploy correctness is covered by a **deep post-deploy smoke**
  in CI — `/health` does a real `Store` round-trip to Postgres, and the smoke also
  fetches the SPA index + one static asset (proves the artifact serves, not just
  that the process booted). Add `*.e2e` per app when its critical flows justify it.
- Pages are modelled with **Page Object Models**; base POM lives in
  `packages/test-kit`.
- TDD red/green is the agentic workflow.

### 14. CI/CD — GitHub Actions, affected-only, main → prod

- **PR:** Turbo-affected `lint` + `typecheck` + Vitest + affected apps' `.iwft` +
  `build`. Must pass — **no coverage % gate** (avoids gaming/threshold churn).
- **Merge to main:** deploy **only changed apps** to Fly via `flyctl`.
- **Migrations:** run via `fly.toml` `release_command` on deploy; **forward-only /
  expand-contract**, destructive migrations are a human-gated step.
- **Real-Postgres job:** handler suite + migrations against real Postgres on
  **every PR** (not path-gated — a PG-vs-PGlite gap need not touch `db`/schema).
- **Smoke:** deep post-deploy `/health` (real `Store` round-trip) + SPA-index/asset fetch.
- **Rollback:** on smoke failure Fly keeps the last healthy release serving;
  expand-contract migrations are what make that safe (prior version runs against
  the migrated schema).
- **No per-PR preview environments** (Fly MPG doesn't branch cleanly; cost).

### 15. Observability — logs now, Sentry later

Structured JSON logging (`packages/logger`) + Fly's log stream for V1. Add Sentry
per app when an app warrants it; not wired into the baseline.

### 16. Documentation discipline

- **ADRs:** MADR-lite (Context / Decision / Consequences), numbered,
  `docs/adr/NNNN-title.md`.
- **`CLAUDE.md`:** root (repo-wide conventions + checklists) and per-app (app
  specifics).
- **READMEs:** per package.
- **No separate progress/status doc** — git history + ADRs are the record.

### 17. Baseline tooling defaults

TypeScript `strict`; ESLint flat config + Prettier; SCSS modules; Vitest as the
unit runner; Node LTS pinned via `.nvmrc` + `packageManager` in `package.json`.

**Pinned majors** (exact patch chosen at `pnpm install` time):

| Tool | Pin |
|---|---|
| Node | **22 LTS** (`.nvmrc`; Docker base `node:22-slim`) |
| pnpm | **9.x** (via `packageManager` + corepack) |
| React | **19** |
| tRPC | **v11** |
| TanStack Router / Query | **Router 1.x / Query 5.x** |
| Drizzle / PGlite | latest — **pin exact** (PGlite is pre-1.0, moves fast) |
| Playwright | latest — **pin exact** (Component Testing is experimental; expect bumps) |
| Env validation | **zod** (already in-tree for tRPC input validation; no extra dep) |

`@electric-sql/pglite` is a dev/test dependency only and must be **excluded from
production bundles** (asserted in CI — see ADR 0001 §5, plan T2.1/T3.2).

## Consequences

- **Positive:** fast inner loop with no Docker (PGlite simulator); high-fidelity
  frontend tests that exercise real backend logic; cheap Fly footprint
  (one container/app by default); clean compliance story (data stays in Fly LHR);
  trivial "add an app" path; low-ceremony CI that only touches what changed.
- **Costs / risks:** layered + DI is more ceremony per app than mounting tRPC
  directly — accepted as the price of standalone-run + `.iwft`. The leaf-node
  rule is unenforced (convention only) — revisit if violated. **PGlite now backs
  both dev and the primary IWFT path**, so PGlite-vs-real-Postgres gaps could
  mask bugs on the main test path; mitigated by a **CI job running the handler
  suite + migrations against real Postgres on every PR** (path-gating it would
  miss handler bugs that don't touch `db`/schema), an **evidence-based list of
  required PG features confirmed on PGlite** (plan T2.1), plus docker-stack mode. No preview envs — reviewers run apps locally in simulator
  mode instead. IWFT couples frontend tests to backend correctness — mitigated by
  pinning backend behaviour in the fast Vitest layer. SPA default means **two
  frontend models** once an app opts into TanStack Start (ADR 0003) — accepted,
  isolated by the leaf-node rule.
- **Deferred, not dismissed:** Terraform, Kubernetes (AWS graduation path);
  per-PR previews; full E2E; Sentry; a scaffolding generator; an ESLint boundary
  rule.
