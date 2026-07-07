# sprout

The child-safe LLM web app on `sprout.homeofed.com`, being migrated into the hub
per [`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).
Its headless safety pipeline lives beside it in [`apps/sprout-pipeline`](../sprout-pipeline).

**Current phase: P0 (scaffold).** Still the stateless starter baseline
([ADR 0007](../../docs/adr/0007-reference-starter-app.md),
[ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) with its identity
renamed; the greeting route is a placeholder verify signal. Database, auth, the
tRPC backend, the SPA frontend, and streaming arrive in later phases.

One route rendering `trpc.greeting()` — a value computed through the full layered
path, no persistence:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=sprout` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=sprout` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). See [`CLAUDE.md`](CLAUDE.md) for layout and the migration phases.
