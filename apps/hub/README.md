# hub

Launcher/landing page for `homeofed.com`. One route rendering `trpc.health()` —
a value read from Postgres/PGlite through the full layered path:

```
HomePage → TanStack Query → tRPC client → router → HealthHandler → HealthStore → DbClient
```

Three ways to run it, one router:

| Mode | Command | Persistence |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=hub` | Node-side PGlite (Vite middleware) |
| .iwft | `pnpm test --filter=hub` | in-browser PGlite-WASM |
| production | `pnpm build && pnpm start` | real Postgres (`DATABASE_URL`) |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + deep
`/health`); deploy-time migrations are `src/server/migrate.ts` (journal-tracked
run-once). See [`CLAUDE.md`](CLAUDE.md) for layout, commands, and scoped rules.
