# apps/sprout-pipeline

The headless LLM safety pipeline for [`apps/sprout`](../sprout), a **separate Fly
app** for secret/attack-surface isolation (ADR 0001 §3; plan
[`0004`](../../docs/plans/0004-sprout-migration-plan.md) §5.5, decision D7). Its
shape — a deployable app with no SPA, no `Store`, no PGlite, private-only — is
[ADR 0013](../../docs/adr/0013-headless-service-app-shape.md).

**Migration complete (P6).** The 13 safety modules + their vitest suites and the
adversarial eval ratchet (`src/eval/`) are ported from the source `apps/pipeline`
faithfully (import hygiene only — no logic changes), and `src/index.ts` is the
Hono→Fastify orchestrator port: `buildServer(deps)` with the `OpenAI`/OpenRouter
client **injected** (not constructed at module scope), so the orchestrator is
testable (`index.test.ts`). The #4A review fix is applied — `detectSensitiveTopics`
and `checkConversationDepth` run on the **canonicalised scan copy**. Chat + summary
stream over SSE (`reply.hijack()` + `reply.raw.write()`); the `x-pipeline-key`
guard fails closed and prod-boot refuses to start without its secrets. Deploy
config (private `fly.toml`, headless Dockerfile, compose service) is P8.

**Modules:** `blocklist`, `canonicalise`, `crescendo`, `opinion-vote`,
`prompt-injection`, `context-anchoring`, `validation`, `safety-classifier`,
`sensitive-topics`, `depth-tracking`, `lexical-classifier`, `prompt`,
`flag-and-forward` (no test, matches source), plus `eval/` (`harness.ts`,
`trick-set.ts`, `eval.test.ts`). `validation.ts` and `prompt.ts` take `PresetName`
/ `PresetSliders` / `CalibrationAnswer` from `@hoe/sprout-shared` (also consumed by
`apps/sprout`). `validation.ts` and `safety-classifier.ts` take the `OpenAI` client
as a plain function parameter, DI'd at the orchestrator boundary in `index.ts`.

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
- `pnpm test:eval --filter=sprout-pipeline` — the adversarial eval ratchet only
  (`vitest run src/eval`); prints the bypass-rate report.
- Prod (container, P8): `node src/index.ts` (native TS, ADR 0004; default port 8080).

## Rules

- Relative imports carry explicit `.ts` extensions; native-Node TS (ADR 0004).
- TDD: unit-test with Fastify's `app.inject(...)`; keep the HTTP layer thin so the
  ported safety modules stay framework-agnostic.
