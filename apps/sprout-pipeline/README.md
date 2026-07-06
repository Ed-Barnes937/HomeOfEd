# sprout-pipeline

Headless LLM safety pipeline service for [`sprout`](../sprout) — a separate Fly
app (`hoe-sprout-pipeline`) for secret/attack-surface isolation. Bare Fastify, no
SPA, no database. See the migration plan
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md)
(§5.5, D7) and [`CLAUDE.md`](CLAUDE.md).

**Current phase: P0 (scaffold)** — a minimal Fastify server exposing a shallow
`/health`. The safety modules and orchestrator (ported Hono → bare Fastify) come
in P6.

```bash
pnpm dev --filter=sprout-pipeline    # node --watch on port 3005
pnpm test --filter=sprout-pipeline   # vitest
```
