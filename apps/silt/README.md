# silt

A basic cellular-automaton sandbox at `silt.homeofed.com`. Scaffolded from
`templates/starter` ([ADR 0007](../../docs/adr/0007-reference-starter-app.md)),
**stateless** ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)) —
the simulation runs client-side. The engine, renderer, and UI land in later
tickets; today this is the placeholder shell.

One route rendering `trpc.greeting()` — a value computed through the full
layered path, no persistence:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=silt` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=silt` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). No database, no migrations. See [`CLAUDE.md`](CLAUDE.md) for
layout, commands, and rules.
