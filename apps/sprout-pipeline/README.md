# sprout-pipeline

Headless LLM safety pipeline service for [`sprout`](../sprout) — a separate Fly
app (`hoe-sprout-pipeline`) for secret/attack-surface isolation. Bare Fastify, no
SPA, no database. See the migration plan
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md)
(§5.5, D7) and [`CLAUDE.md`](CLAUDE.md).

**Current phase: P6a done** — the 13 safety modules + vitest suites and the
`src/eval/` adversarial ratchet are ported. `src/index.ts` is still the P0
bare-Fastify skeleton (`/health` only); the Hono→Fastify orchestrator port and
OpenAI client DI are **P6b**.

```bash
pnpm dev --filter=sprout-pipeline        # node --watch on port 3005
pnpm test --filter=sprout-pipeline       # vitest
pnpm test:eval --filter=sprout-pipeline  # the adversarial eval ratchet only
```
