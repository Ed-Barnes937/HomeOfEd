# boop

A kid-friendly (6+) music toy: a 6-instrument x 16-step step-sequencer that
loops forever. Tap or drag to paint beats, hear every edit instantly, share a
groove as a link. No scores, levels, timers, or fail states — fun is the
point. Lives at `boop.homeofed.com`. See
[`.scratch/music-app/spec.md`](../../.scratch/music-app/spec.md) for the full
product spec and [`docs/reference/boop-design/README.md`](../../docs/reference/boop-design/README.md)
for the visual design handoff.

**Stateless** — no database ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)).
The grid, tempo, and saved grooves persist to `localStorage`; sharing a groove
is URL-hash encoded (V1) with a server snapshot fallback modelled on
`apps/fridge`'s `board.share` pattern for later.

This ticket (11) is the scaffold only: one placeholder route proving the full
layered path, no persistence yet:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=boop` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=boop` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). No database, no migrations. See [`CLAUDE.md`](CLAUDE.md) for
layout, commands, and scoped rules.
