# apps/sprout-pipeline

The headless LLM safety pipeline for [`apps/sprout`](../sprout), a **separate Fly
app** for secret/attack-surface isolation (ADR 0001 §3; plan
[`0004`](../../docs/plans/0004-sprout-migration-plan.md) §5.5, decision D7).

**Current phase: P6a done (safety modules ported).** The 13 safety modules +
their vitest suites and the adversarial eval ratchet (`src/eval/`) are ported
from the source `apps/pipeline`, faithfully (import hygiene only — no logic
changes). `src/index.ts` is still the P0 bare-Fastify skeleton (`/health` only)
— the Hono→Fastify orchestrator port, DI'd OpenAI client, `index.test.ts`
integration test, the #4A canonicalise-on-scan-copy review fix, and the
private-network binding are **P6b**, not yet done.

**Modules ported (P6a):** `blocklist`, `canonicalise`, `crescendo`,
`opinion-vote`, `prompt-injection`, `context-anchoring`, `validation`,
`safety-classifier`, `sensitive-topics`, `depth-tracking`, `lexical-classifier`,
`prompt`, `flag-and-forward` (no test, matches source), plus `eval/` (`harness.ts`,
`trick-set.ts`, `eval.test.ts`). `validation.ts` and `prompt.ts` take `PresetName`
/ `PresetSliders` / `CalibrationAnswer` from `@hoe/sprout-shared` (the P6a package
extraction — also consumed by `apps/sprout`). `validation.ts` and
`safety-classifier.ts` take an `OpenAI` client as a plain function parameter
(unchanged from source) — P6b's job is to DI it at the orchestrator boundary
instead of constructing it at module scope in `index.ts`.

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
