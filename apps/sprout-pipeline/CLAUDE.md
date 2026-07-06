# apps/sprout-pipeline

The headless LLM safety pipeline for [`apps/sprout`](../sprout), a **separate Fly
app** for secret/attack-surface isolation (ADR 0001 §3; plan
[`0004`](../../docs/plans/0004-sprout-migration-plan.md) §5.5, decision D7).

**Current phase: P0 (scaffold).** A minimal bare-Fastify skeleton with only a
shallow `/health` route. The safety modules, orchestrator, and the SSE token
stream (ported Hono → bare Fastify, OpenAI client injected) land in P6.

## Shape (deliberate deviations)

Headless service, not a standard hub app:

- **No SPA, no `createAppServer`** — bare Fastify (`buildServer()` in
  `src/index.ts`). One headless service does not justify a shared factory; a
  `createServiceServer` is extracted only if a second appears (plan Appendix A).
- **No database, no Store, no PGlite** — owns no persistent state (ADR 0008); the
  web app persists flag events, the pipeline stays DB-less. `/health` is shallow
  liveness, no Store round-trip.
- **No `@hoe/backend-kit`** — headless. It consumes `@hoe/logger` and
  `@hoe/config` only.
- **Not publicly routed** in prod — reached by the web app over Fly's private
  network (`.flycast`), guarded by `x-pipeline-key` (P6/P8).

## Commands

- `pnpm dev --filter=sprout-pipeline` — `node --watch src/index.ts` on port **3005**.
- `pnpm test --filter=sprout-pipeline` — Vitest (`*.test.ts`).
- Prod (container, P8): `node src/index.ts` (native TS, ADR 0004; default port 8080).

## Rules

- Relative imports carry explicit `.ts` extensions; native-Node TS (ADR 0004).
- TDD: unit-test with Fastify's `app.inject(...)`; keep the HTTP layer thin so the
  ported safety modules stay framework-agnostic.
