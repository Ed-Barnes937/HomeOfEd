# 0013 — Headless service app shape (the sprout pipeline)

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [0004-sprout-migration-plan.md](../plans/0004-sprout-migration-plan.md)
  §5.5 (D7), [0001-foundation.md](0001-foundation.md) §3 (secret isolation /
  when to split a Fly app), [0004-typescript-source-exports.md](0004-typescript-source-exports.md),
  [0008-apps-without-a-database.md](0008-apps-without-a-database.md), root
  `CLAUDE.md` hard rule 3

## Context

sprout's LLM safety pipeline (13 guardrail modules + an adversarial eval ratchet)
holds the OpenRouter/OpenAI key and does the model calls. Per ADR 0001 §3 it is a
**separate Fly app** from the web app, so that the LLM key and the model-facing
attack surface are isolated from the public web tier (D7).

But the pipeline is not a normal HomeOfEd app. It has **no SPA**, **no database**,
**no user sessions**, and is **never publicly routed** — the web app calls it over
Fly's private network. Every existing app is built on `createAppServer` (Fastify +
tRPC + a static SPA + a `Store`). Applying that factory here would force an SPA
bundle, a `Store`, and a tRPC surface that this service does not have and does not
want. The source pipeline was a bare **Hono** server — the estate's only non-Fastify
HTTP layer.

The question P10 records: what *is* a deployable HomeOfEd app that serves no UI and
owns no data, and how much of the app rulebook still applies to it?

## Decision

Define the **headless service** app shape and build the pipeline as the first one.

**What it keeps** (the rules that are about correctness, not about being a web app):

- **Layered + DI.** The HTTP layer is thin; the safety modules are
  framework-agnostic pure functions. The `OpenAI`/OpenRouter client is **injected**
  into `buildServer(deps)`, not constructed at module scope, so the orchestrator is
  testable (this also closed the source's "orchestrator has no tests" gap).
- **Shared plumbing** it genuinely needs: `@hoe/config` (tsconfig/eslint/prettier),
  `@hoe/logger`, and `@hoe/sprout-shared` (presets/calibration, shared with the web
  app). TS source exports run natively per ADR 0004.
- **TDD**, via Fastify's `app.inject(...)` against the injected seams.
- Shared **Dockerfile discipline, `fly.toml`, compose service, and CI job** shape.

**What it drops** (the rules that only make sense for a web app):

- **No `createAppServer`.** The HTTP layer is **bare Fastify** (`buildServer()` in
  `src/index.ts`) — one headless service does not justify a shared factory.
- **No `@hoe/backend-kit`, no `Store`, no PGlite, no tRPC, no SPA.** It owns no
  persistent state (ADR 0008); sprout's web app persists flag events, the pipeline
  stays DB-less. `/health` is shallow liveness, not a `Store` round-trip.
- **Not publicly routed.** No `[http_service]`/`[[services]]` in its `fly.toml`, so
  Fly allocates no public IP or edge hostname; it is reachable only on the org's
  6PN network via `hoe-sprout-pipeline.flycast`, guarded by an `x-pipeline-key`
  shared secret. No Cloudflare CNAME.

**Future upgrade path (do not pre-build it).** When a **second** headless service
exists, extract a `createServiceServer` into `backend-kit` — bare Fastify with
health + logger + a route-registration hook, and no static/SPA/`Store` — and
migrate both onto it. Until then, one consumer does not justify the abstraction
(the same extract-on-second-use rule as everywhere else; contrast ADR 0009, where
the second consumer was already a firm requirement — here it is not).

## Consequences

- The pipeline deploys as a first-class app (its own image, `fly.toml`, CI job)
  while honouring what it actually is: a private, stateless, UI-less service.
- The estate's only non-Fastify server is gone; the framework is now uniform.
- The key isolation ADR 0001 §3 asks for is real: `OPENROUTER_API_KEY` lives only
  on `hoe-sprout-pipeline`, never on the public web app.
- The cost is a second app to deploy and a private-network hop on every chat turn.
  Accepted — it is the price of secret isolation, and the web app fails closed if
  the pipeline is unreachable.
- There is a small, named piece of duplication in waiting: the bare-Fastify boot
  (health + logger + `x-pipeline-key`) will be re-implemented if a second service
  appears before the `createServiceServer` extraction. That is the deliberate cost
  of not abstracting on one consumer.
