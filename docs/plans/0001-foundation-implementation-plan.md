# Foundation implementation plan

Turns [ADR 0001](../adr/0001-foundation.md) and
[ADR 0002](../adr/0002-documentation-and-delivery.md) into executable vertical
slices for Claude agent teams.

**End goal:** all **local-only** code ready, so releasing the first real app
needs only the human-run infrastructure steps in Phase 4. Agents stop at the
boundary of deployed infrastructure.

## How to use this plan

- Work top-down by phase. Within a phase, tasks marked **∥ parallel** can run
  concurrently; each declares the files/dirs it **owns** so agents don't collide.
- Every task is **done** only when: its acceptance tests pass (written first,
  red → green), `pnpm lint` + `pnpm typecheck` are green, and its README/scoped
  `CLAUDE.md` is current.
- **Contracts before parallelism:** Phase 1 fixes the cross-package interfaces.
  Phases 2–3 implement against them in parallel.
- **Never touch deployed infra.** Phase 4 tasks are human runbooks, not agent
  work.

**Package namespace:** `@hoe/*` (e.g. `@hoe/db`). Adjust once if you prefer
another scope — do it before Phase 1.

**Pinned versions:** Node 22 LTS · pnpm 9 · React 19 · tRPC v11 · TanStack
Router 1 / Query 5 · zod for validation · Drizzle / PGlite / Playwright pinned
**exact** at install (PGlite pre-1.0; Playwright Component Testing experimental).
Docker base `node:22-slim`. Full table in [ADR 0001 §17](../adr/0001-foundation.md).

**Reference app is `apps/hub`** — the landing page at the apex `homeofed.com`
(and the navigation hub out to other apps); there is no `www.` subdomain.

### Task spec format

> **ID** — title · *track* · **owns:** dirs · **depends:** ids
> **Goal** · **Contract** (public API/types other slices rely on) ·
> **Acceptance** (tests) · **DoD**

---

## Phase 0 — Tooling spine

*Single track. Blocks everything. Keep it small.*

> **T0.1 — Workspace init** · sequential · **owns:** repo root config · **depends:** —
> **Goal:** pnpm + Turborepo skeleton.
> **Deliver:** `pnpm-workspace.yaml`, root `package.json` (scripts: `dev`,
> `build`, `lint`, `typecheck`, `test`; `packageManager` pinned), `.nvmrc`
> (Node LTS), `.gitignore`, `turbo.json` (pipeline for build/dev/lint/typecheck/
> test with sensible `dependsOn` + caching).
> **Acceptance:** `pnpm install` clean; `pnpm lint/typecheck/test` run green over
> the empty graph (no-op).
> **DoD:** root README "Getting started" verified accurate.

> **T0.2 — `@hoe/config`** · sequential · **owns:** `packages/config` · **depends:** T0.1
> **Goal:** shared base configs.
> **Deliver:** `tsconfig.base.json` (`strict`), ESLint flat config, Prettier
> config, exported for extension by every package/app. README. **Decide
> TS project references vs bundler `paths`** for cross-package types and
> incremental typecheck (default: project references); record the choice.
> **Contract:** `@hoe/config/tsconfig.base.json`, `@hoe/config/eslint`,
> `@hoe/config/prettier`.
> **Acceptance:** a throwaway package extending these lints/typechecks; a
> deliberate violation fails CI.
> **DoD:** `packages/config/README.md`.

---

## Phase 1 — Walking skeleton (tracer bullet) · LOCAL ONLY

*Single track. De-risks the whole architecture and fixes the cross-package
contracts. Builds **minimal but real** versions of db / backend-kit / test-kit
plus `apps/hub`, running in simulator mode. No Dockerfile, no deployed infra.*

> **T1.1 — End-to-end tracer bullet** · sequential · **owns:** initial skeletons of
> `packages/db`, `packages/backend-kit`, `packages/test-kit`, `apps/hub` ·
> **depends:** T0.2
>
> **Goal:** Prove the **SPA** stack (TanStack Router + Query + tRPC client) +
> layered tRPC handler + DI + `Store`(PGlite) + the dev/IWFT wiring + one Vitest
> test + one `.iwft` test, all running via `pnpm dev --filter=hub` with **no
> Docker and no deployed infra**. (SPA default per [ADR 0003](../adr/0003-spa-default-tanstack-start-opt-in.md);
> no TanStack Start, no server functions.)
>
> **Build the minimum real seam in each package:**
> - `@hoe/db`: Drizzle client **factory with driver swap** (`postgres` |
>   `pglite`), proven to run PGlite **both Node-side and in-browser (WASM)**; one
>   tiny `health` schema; migration applied at PGlite instance creation.
> - `@hoe/backend-kit`: `Store` interface; base handler class; the **tRPC
>   router**; a wiring that injects a PGlite-backed `Store` into the tRPC context,
>   reusable **two ways** — (a) a Vite dev-server middleware (dev simulator mode),
>   (b) an in-browser dispatcher the test-kit drives via `page.route`.
> - `@hoe/test-kit`: Playwright **Component Testing** config; base Page Object
>   Model; a fixture that mounts the SPA and routes its tRPC calls to the real
>   router over an in-browser PGlite (`page.route` dispatch).
> - `apps/hub`: one route/page calling `trpc.health()` → handler class →
>   `Store` (PGlite) → returns `ok` + a DB-sourced value; one SCSS module;
>   scoped `CLAUDE.md`.
>
> **Validate the load-bearing risk (ADR 0003) — spike first:** the tRPC router +
> PGlite-WASM must **bundle into the browser CT build** (server-only deps
> browser-safe). If impractical, fall back to booting a plain (non-SSR)
> tRPC+static server with PGlite on an ephemeral port. Prototype in-browser first;
> **freeze the winner.** **Run this spike *before* freezing the contract** — the
> test-kit's transport shape depends on the outcome — and record the chosen branch
> at the checkpoint.
>
> **Contract (frozen for Phases 2–3 — change only via follow-up).** These are the
> **starting shapes**; **freezing them is the *last* step of T1.1, after the spike
> above resolves.** Names/fields may be adjusted during T1.1; they are fixed once
> the checkpoint passes.
>
> **The block below encodes the *in-browser* branch.** `dispatchRequest` and
> `mountApp`'s `page.route` wiring assume the spike's preferred outcome. **If the
> fallback (ephemeral tRPC+static server) is chosen, the test-kit transport seam
> (`dispatchRequest` / `mountApp`) is re-specified at the checkpoint before
> Phase 2 fans out** — everything else in the block is transport-independent.
>
> ```ts
> // ── @hoe/db ──────────────────────────────────────────────────────────────────
> type Driver = 'postgres' | 'pglite'
> function createDbClient<S>(opts: { driver: Driver; schema: S; url?: string }): DbClient<S>
> //   DbClient<S> = a Drizzle client bound to the app's schema; PGlite-backed when
> //   driver==='pglite' (Node-side for dev, WASM in-browser for .iwft).
> function freshTestDb<S>(schema: S): Promise<DbClient<S>>  // new PGlite, migrated at creation = per-test reset
>
> // ── Store: app-defined, NOT @hoe/db's client ────────────────────────────────
> //   Each app declares its OWN Store interface (its query surface) and ONE impl
> //   over a DbClient. "Real vs simulator" is just the DbClient's driver
> //   (Postgres ↔ PGlite) — not a second class. Unit (.test) MAY inject a trivial
> //   hand-written Store fake; dev + .iwft inject the real impl over PGlite.
> interface HealthStore { ping(): Promise<{ ok: true; value: string }> }  // tracer-bullet Store, owned by apps/hub
>
> // ── @hoe/backend-kit ─────────────────────────────────────────────────────────
> interface Logger {                            // minimal shape FROZEN here; @hoe/logger (T2.3) implements it
>   debug(m: string, f?: Record<string, unknown>): void
>   info(m: string, f?: Record<string, unknown>): void
>   warn(m: string, f?: Record<string, unknown>): void
>   error(m: string, f?: Record<string, unknown>): void
>   child(bindings: Record<string, unknown>): Logger
> }
> interface BlobStore {                         // real impl (Tigris) deferred; in-memory fake in T2.2
>   put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void>
>   get(key: string): Promise<Uint8Array | null>
>   delete(key: string): Promise<void>
> }
> type User = { id: string }                    // extensible per app via intersection
> interface AppContext<Store> {                 // the single tRPC context; the DI seam (generic over the app's Store)
>   store: Store
>   blobs: BlobStore
>   auth: { getUser(): User | null }            // auth seam — hub injects () => null
>   now(): Date                                 // clock seam — tests pin time
>   logger: Logger
> }
> abstract class Handler<Input, Output, Store> {            // domain layer; depends on AppContext only
>   abstract run(input: Input, ctx: AppContext<Store>): Promise<Output>
> }
> function createContext<Store>(deps: {                     // Store-injection seam: inject the singletons →
>   store: Store; blobs: BlobStore; logger: Logger; now?: () => Date    // tRPC's PER-REQUEST context factory.
> }): (req: Request) => AppContext<Store>                   // auth is derived from req inside the returned fn;
>                                                           // store/blobs/logger/now are closed over (now defaults to () => new Date())
> export type AppRouter = typeof appRouter      // per app; exported for the client + all three transports
>
> type FailureRule = { path: string; mode: 'error' | 'latency' | 'network'; ms?: number }
> //   test-only failure-injection tRPC link. SIGNATURE FROZEN HERE — T2.2 implements
> //   it but must NOT change the shape (this is what keeps T2.4 independent of T2.2).
>
> function dispatchRequest(req: Request): Promise<Response>
> //   in-browser dispatch seam backend-kit EXPORTS for test-kit's page.route handler:
> //   a captured tRPC HTTP request → real router → Response.
>
> function createAppServer(opts: {             // prod transport — built T2.2, instantiated T3.1
>   router: AppRouter
>   createContext: (req: Request) => AppContext<unknown>   // the per-request factory above; <unknown> is deliberate
>   staticDir: string; logger: Logger                      // type-erasure at the transport boundary (router carries its own ctx type)
> }): { listen(port: number): Promise<void> } // Fastify: @fastify/static + tRPC adapter + a deep /health route
>
> // ── @hoe/test-kit ────────────────────────────────────────────────────────────
> type SeedFn = (db: DbClient<unknown>) => Promise<void>    // seeding runs against the test DbClient
> interface MountedApp { page: Page; root: BasePage }       // Page from @playwright/test; what an .iwft test receives back
> abstract class BasePage { /* POM base: locators + actions */ }
> function mountApp(opts?: { seed?: SeedFn; failures?: FailureRule[]; user?: User | null }): MountedApp
> //   CT fixture: mounts the SPA; page.route → backend-kit dispatchRequest → real AppRouter over in-browser PGlite.
> ```
>
> **All three transports run the same router + `createContext`:** `dev` via the
> Vite middleware, `.iwft` via `page.route` → `dispatchRequest`, prod via
> `createAppServer` (built T2.2, instantiated T3.1).
> **Acceptance:**
> - `pnpm dev --filter=hub` serves the SPA locally against PGlite (Vite middleware).
> - `apps/hub/**/health.test.ts` (handler unit, injected fake) green.
> - `apps/hub/**/health.iwft.tsx` (CT mounts SPA; page renders health via the
>   in-browser real router over PGlite) green.
> - Red→green demonstrated for at least one of the above.
> **DoD:** the four packages/app have README/`CLAUDE.md` stubs documenting the
> frozen contract. **No** Dockerfile/compose/CI yet.

---

## ⛔ Human-in-the-loop checkpoint — sign off the frozen contracts

*Between T1.1 and Phase 2. Phase 2 fans out four parallel agents that all build
against the T1.1 contracts; a wrong shape caught here is fixed once, not across
four packages.*

The T1.1 agent presents, for human review: (a) **which transport branch was
frozen** — in-browser bundle vs ephemeral server (the spike outcome) — and (b) the
**final frozen signatures** (the `ts` block above, as actually implemented). The
human confirms `Store` (app-defined) + `DbClient`, `BlobStore`, `Logger`,
`AppContext` (incl. the `auth` + `now()` seams), the handler base, the
`createContext` injection seam, the `FailureRule` link, the `dispatchRequest`
in-browser seam, `createAppServer`, `@hoe/db`'s `createDbClient`/`freshTestDb`, and
`@hoe/test-kit`'s `BasePage`/`SeedFn`/`MountedApp`/`mountApp`. **Phase 2 does not
start until this passes.** Changes after sign-off are follow-up tasks, not silent
edits.

---

## Phase 2 — Harden the packages · LOCAL ONLY

*∥ All four parallel. Each owns one package dir → no collisions. Implement
against the Phase 1 contract.*

> **T2.1 — `@hoe/db`** · ∥ · **owns:** `packages/db` · **depends:** T1.1
> **Goal:** production-grade data layer.
> **Deliver:** migration runner (generate + apply) for real Postgres **and**
> PGlite (Node + browser/WASM); seed support; **per-test reset = fresh PGlite
> instance** (migrate at creation, not per test); a **typed env module +
> `.env.example`** (`DATABASE_URL` etc. validated through a **zod** schema, parsed
> once at startup); driver-swap finalised so `@electric-sql/pglite` is **excluded
> from production bundles**.
> **Acceptance:** migrations apply on both drivers; round-trip test on PGlite
> (Node and browser); same suite runnable against a real PG (used in T3.3); a
> build assertion that `pglite` is absent from a prod build; **an enumerated list
> of the Postgres features apps may rely on** (e.g. `gen_random_uuid`, JSON/JSONB
> operators, transactions, constraints/`ON CONFLICT`, and `LISTEN/NOTIFY` if used)
> with a test confirming PGlite supports each — so the PGlite-vs-PG fidelity gap is
> **bounded by evidence**, not assumed.
> **DoD:** README documents the factory, driver swap, migration + env commands, and
> the **migration policy: forward-only / expand-contract; a destructive migration
> is flagged and applied as a human-gated step, not run silently by `release_command`.**

> **T2.2 — `@hoe/backend-kit`** · ∥ · **owns:** `packages/backend-kit` · **depends:** T1.1
> **Goal:** the full backend kit + simulator wiring.
> **Deliver:** `BlobStore` **in-memory fake** (interface frozen in T1.1; **real
> Tigris impl deferred** until an app stores a blob — docs-only, like REST);
> finalised handler base + DI container; tRPC router/context + a documented
> **domain-error → tRPC-error-code → HTTP** mapping (the error taxonomy, applied
> consistently so apps don't each invent one); the **`Store`-injection wiring**
> reused two ways (Vite dev middleware + in-browser `dispatchRequest`); the prod
> **`createAppServer({ router, createContext, staticDir, logger })`** factory on
> **Fastify** (`@fastify/static` for the SPA bundle + SPA
> fallback, tRPC Fastify adapter for the API; `@fastify/websocket` left as the
> documented WS-escalation path, not wired); the **test-only failure-injection
> tRPC link** (error/latency/network by procedure path). REST adapter is
> **docs-only — not built until an app needs it** (avoids speculative code).
> **Acceptance:** handler runs identically against real-vs-fake injected store; a
> blob round-trip on the in-memory fake; the **same router** serves all three
> transports — Vite middleware, in-browser dispatcher, and `createAppServer`
> (static + tRPC, with a `/health` route) verified locally.
> **DoD:** README covers handler authoring, DI, the tRPC router, `createAppServer`,
> and the simulator wiring.

> **T2.3 — `@hoe/logger`** · ∥ · **owns:** `packages/logger` · **depends:** T1.1
> **Goal:** structured JSON logging.
> **Deliver:** levelled JSON logger, request/context binding, redaction of
> secrets, a hook for the app's Node/tRPC server.
> **Acceptance:** emits valid JSON with expected fields; redaction test.
> **DoD:** README with usage + field conventions.

> **T2.4 — `@hoe/test-kit`** · ∥ · **owns:** `packages/test-kit` · **depends:** T1.1
> **Goal:** the shared testing harness. **Codes against the T1.1-frozen contract**
> (CT fixture + `page.route` dispatch + injection seam), not T2.2's internals.
> **Deliver:** Playwright **Component Testing** config (`.iwft` active) + a
> standard `.e2e` config (defined, skipped); base POM utilities; a fixture that
> mounts an app's SPA and routes its tRPC calls to the real router over an
> **in-browser PGlite** (`page.route` dispatch); fresh-PGlite-per-test reset;
> seed + failure-injection helpers; extension-routing so Vitest owns `*.test` and
> Playwright owns `*.iwft`/`*.e2e`.
> **Acceptance:** a sample `.iwft` against `hub` runs green through the kit;
> Vitest and Playwright don't pick up each other's files.
> **DoD:** README documents writing `.iwft` tests + POM conventions.

---

## Phase 3 — `hub` complete + containerisation + CI · LOCAL ONLY

*Mostly sequential on Phase 2. Nothing here is deployed; everything is verifiable
locally. Completing this phase = **the agent end goal**.*

> **T3.1 — `apps/hub` complete** · sequential · **owns:** `apps/hub` · **depends:** T2.*
> **Goal:** the reference app, complete.
> **Deliver:** real (minimal) landing page; full `health` path; app-owned schema
> + real `Store` impl (Postgres) + PGlite fake wiring; the thin server entrypoint
> calling **`createAppServer`** (router + a `createContext` that injects the real
> Postgres `Store` + `staticDir` + logger); SCSS modules; fuller `.iwft` coverage
> via POM; scoped `CLAUDE.md` + README.
> **Acceptance:** `pnpm dev --filter=hub` (simulator) works; `pnpm test
> --filter=hub` green (`.test` + `.iwft`).
> **DoD:** `hub` is a clean, copyable template for "adding an app".

> **T3.2 — Dockerfile + `fly.toml` for `hub`** · ∥ (with T3.3) · **owns:**
> `apps/hub/Dockerfile`, `apps/hub/fly.toml` · **depends:** T3.1
> **Goal:** the real deploy artifact (not deployed).
> **Deliver:** multi-stage Dockerfile on **`node:22-slim`** using **`turbo prune
> --docker`** (or `pnpm deploy`) so the build context is the **pruned single-app
> subtree** (not the whole monorepo): stage 1 prune, stage 2 install + `turbo
> build --filter=hub`, stage 3 runtime = the **`createAppServer` process**
> (static SPA bundle + tRPC, Fastify) + prod deps only. Pin pnpm via corepack.
> `fly.toml` with `release_command` running migrations + a `/health` check.
> London region.
> **Acceptance:** `docker build` succeeds; container serves the SPA + `/health`
> locally; **final image contains no dev deps, no other apps, and no `pglite`/
> test-helper modules.**
> **DoD:** comments note which values change per app.

> **T3.3 — Docker-stack mode** · ∥ (with T3.2) · **owns:** `compose.yml` ·
> **depends:** T3.1
> **Goal:** run the real artifact against real Postgres locally.
> **Deliver:** `compose.yml` building `hub`'s Dockerfile + a Postgres service,
> env/secrets wired (local secrets from a **gitignored `.env` / compose `env_file`**,
> never committed); filterable to one app + its DB.
> **Acceptance:** `docker compose up` serves `hub` against **real Postgres**;
> `@hoe/db` migrations apply; `/health` green — confirming no PGlite-vs-PG gap.
> **Also add a CI job** (in T3.4) running the handler suite + migrations against
> **real Postgres on every PR** — *not* path-gated on `db`/schema: a handler bug
> that depends on a PG-vs-PGlite semantic difference need not touch those files, so
> a path filter is exactly the blind spot. One Postgres container is cheap.
> **DoD:** README "Docker stack" section verified.

> **T3.4 — CI pipeline** · sequential · **owns:** `.github/workflows/*` ·
> **depends:** T3.1
> **Goal:** the lightweight CI from ADR 0001 §14, written but not yet live.
> **Deliver:** PR workflow (Turbo-affected `lint`/`typecheck`/`test` incl `.iwft`/
> `build`, affected computed against **`origin/main`** — `--filter='...[origin/main]'`
> with full-history `fetch-depth: 0` in the checkout; **`playwright install
> --with-deps` + browser cache** for the CT run);
> a **real-Postgres job** (handler suite + migrations) on **every PR** (per T3.3) —
> by design the CI long pole; if PR latency bites, affected-gate it to *any package*
> (not path-gate to `db`), which keeps the blind-spot fix;
> deploy workflow (on merge to `main`: deploy changed apps via `flyctl`, migrations
> via `release_command`, **post-deploy smoke: deep `/health`** — a real `Store`
> round-trip to Postgres — **plus a fetch of the SPA index and one static asset**,
> proving the deployed artifact actually serves, not just that the process booted).
> **On smoke failure, Fly holds the previous healthy release** (no traffic shift to
> the bad version); the **expand-contract migration policy** (T2.1) is what makes
> that rollback safe — the prior version still runs against the migrated schema.
> Deploy job documents the required `FLY_API_TOKEN` secret and **stays inert until
> Phase 4** provides it.
> **Acceptance:** PR workflow green on a test PR. Deploy workflow lints/validates
> (e.g. `--dry-run` where possible) without deploying.
> **DoD:** workflow files commented; secret requirements listed.

> **T3.5 — "Adding an app" dry run** · sequential · **owns:** docs only ·
> **depends:** T3.1–T3.4
> **Goal:** prove the template path.
> **Deliver:** walk the `CLAUDE.md` checklist against `hub`; correct any drift in
> README/`CLAUDE.md`/ADR.
> **Acceptance:** checklist is sufficient to stand up a second app locally (do a
> throwaway copy, run it in simulator mode, then discard).
> **DoD:** docs accurate; **all local-only code is ready.**

---

## Phase 4 — Infrastructure (human-in-the-loop)

*Not agent work. A human runs these with the Fly CLI + Cloudflare dashboard,
pausing at each gate to learn the steps. Agents prepare runbooks/commands and
wait.*

> **G4.1 — Fly app + Managed Postgres**
> Create the Fly org/app for `hub` (LHR); provision Fly **Managed Postgres**
> (LHR); create the `hub` database; set `DATABASE_URL` + other secrets via `fly
> secrets set`. *Agent provides exact commands; human runs.*

> **G4.2 — GitHub deploy secret**
> Add `FLY_API_TOKEN` (and any deploy secrets) to the GitHub repo so the deploy
> workflow from T3.4 can run.

> **G4.3 — First deploy**
> Trigger the deploy (CI or `fly deploy`); confirm `release_command` runs
> migrations against Managed Postgres; hit the `*.fly.dev` URL.

> **G4.4 — Cloudflare DNS + TLS**
> Add the proxied CNAME (apex `homeofed.com` → the `hub` Fly app); set SSL to
> **Full (strict)**; issue the Fly cert (`fly certs add homeofed.com`); verify
> routing + TLS.

> **G4.5 — Verify end-to-end**
> `homeofed.com` serves `hub`; `/health` green in production. Foundation is live;
> the first real app can now be added via the checklist and released by repeating
> G4.1–G4.4 for its subdomain.

---

## Definition of done (foundation)

- Phases 0–3 complete: monorepo + tooling + the five packages + `apps/hub` all
  pass `lint`/`typecheck`/`test` locally.
- `hub` runs in **both** simulator and docker-stack modes.
- Dockerfile, `fly.toml`, `compose.yml`, and CI workflows exist and validate.
- READMEs, scoped `CLAUDE.md`s, and ADRs are current.
- The only remaining work to go live is the Phase 4 human runbooks.

## Parallelisation summary

```
Phase 0   T0.1 → T0.2                         (sequential)
Phase 1   T1.1                                (sequential; freezes contracts)
  ⛔ human-in-the-loop checkpoint            (sign off frozen contracts)
Phase 2   T2.1 ∥ T2.2 ∥ T2.3 ∥ T2.4           (4 agents)
Phase 3   T3.1 → (T3.2 ∥ T3.3) → T3.4 → T3.5
Phase 4   G4.1 → G4.2 → G4.3 → G4.4 → G4.5    (human)
```
