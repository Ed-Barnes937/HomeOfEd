# 0003 — Default to SPA; TanStack Start opt-in

- **Status:** Accepted
- **Date:** 2026-06-30
- **Revises:** [0001-foundation.md](0001-foundation.md) §4/§5/§13 and the
  "TanStack Start frontends" assumption in [hosting.md](../hosting.md).
- **Related:** [genio-backend-simulator-pattern.md](../reference/genio-backend-simulator-pattern.md)

## Context

The foundation originally assumed every app is a **TanStack Start** app (SSR +
server functions on Nitro). Designing the test architecture exposed that this
default carries most of the complexity:

- We decided **tRPC-only data access** (ADR 0001 §4), which **bans data-fetching
  server functions** — removing half of TanStack Start's value before we start.
- SSR forced a heavy `.iwft` harness: boot the real Nitro server per Playwright
  worker on an ephemeral port, with a separate DI path for server functions (the
  re-review's blocking "B5"), plus server-boot/teardown flakiness and CI cost.
- Nothing in the default app set actually needs SSR. Gimmick apps and authed apps
  gain little; the clear SSR case (SEO/first-paint) is the **future blog**.
- Fly's "long-running Node server" rationale in `hosting.md` is about the
  **backend** (WebSockets/streaming for the LLM app), which is a tRPC/WS concern
  **independent of SPA vs SSR**.

## Decision

- **Default frontend = SPA:** React + **TanStack Router** + **TanStack Query** +
  tRPC client. Built with Vite to static assets, served (with the tRPC API) by
  the app's single Node container — the shared Fastify `createAppServer` factory
  (ADR 0001 §3/§8).
- **TanStack Start is opt-in per app**, only when an app genuinely needs SSR /
  SEO / streaming-SSR (e.g. the blog). An opting-in app must **document the added
  test-harness + deploy complexity** in its scoped `CLAUDE.md` and an ADR, and
  still obey **tRPC-only data access** (no data-fetching server functions).
- **tRPC-only data access stays** (ADR 0001 §4). With the SPA default there are
  no server functions at all, so there is a single DI path: the `Store`/`BlobStore`
  is injected into the one tRPC context. The re-review's B5 gap is eliminated.

### `.iwft` mechanism for SPA apps

Playwright **Component Testing** mounts the SPA; tRPC HTTP calls are intercepted
with `page.route` and **dispatched to the real tRPC router** running with
**PGlite (WASM) injected as the `Store`, in-browser** — no server process, no
ephemeral ports, no teardown. This reuses the real router (not a reimplemented
contract) and real SQL, and is the lightest of the options considered.

- **Dev "simulator mode"** uses the same real router + PGlite, but wired as a
  **Vite dev-server middleware** (PGlite running Node-side) instead of
  `page.route`. Dev and IWFT share the router + `Store` injection; only the
  transport differs (Vite middleware vs `page.route`).
- **Per-test isolation:** a fresh in-browser PGlite per test (cheap; WASM loads
  once per worker).
- **Risk to validate in T1.1:** the tRPC router + PGlite-WASM must bundle into
  the browser test build (server-only deps must be browser-safe). If that proves
  impractical, fall back to booting a plain (non-SSR) tRPC+static server with
  PGlite on an ephemeral port. Prototype in-browser first; freeze the winner.

## Consequences

- **Positive:** eliminates the server-function DI gap (B5); a much lighter
  `.iwft` harness (Playwright CT, no per-worker server boot); smaller foundation
  scope (build the SPA harness now, defer the Start harness until the blog);
  faster, simpler local dev (plain Vite); SSR complexity is paid only by apps
  that choose it.
- **Costs:** **two frontend models** once a Start app exists — isolated by the
  leaf-node rule, with a second `.iwft` mechanism deferred until then. **No SSR by
  default** (worse SEO/first-paint for apps that would want it) — recovered via
  opt-in. The SPA's tRPC API is served by the app's Node container alongside its
  static bundle, preserving one-container-per-app.
- **Deferred:** the TanStack Start `.iwft` harness (full-server model from the
  re-review) until the first Start app; revisit if many apps end up opting in.
