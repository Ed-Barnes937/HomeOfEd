# starter

The copy base for new apps ([ADR 0007](../../docs/adr/0007-reference-starter-app.md)):
a deliberately minimal, **stateless** app
([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)). It is never
deployed — it lives in `templates/` so CI keeps it green, and you copy it to
`apps/<name>` to start a new app.

One route rendering `trpc.greeting()` — a value computed through the full layered
path, no persistence:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=starter` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=starter` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). No database, no migrations. See [`CLAUDE.md`](CLAUDE.md) for layout,
commands, and how to add a database if the app needs one.
