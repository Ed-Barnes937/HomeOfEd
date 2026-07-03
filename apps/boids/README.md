# boids

A classic Reynolds boids (flocking) simulator on a full-viewport 2D canvas, with
one floating frosted-glass settings panel (theme chips, a boid-shape picker,
seven sliders) and four preset themes (default: neon). Lives at
`boids.homeofed.com`. Design reference: `docs/reference/boids-design/`.

**No database** — see [ADR 0006](../../docs/adr/0006-db-less-apps.md). The
layered backend skeleton (tRPC → handler → `StatusStore`) is kept for
convention and the `.iwft` harness, but the frontend makes no tRPC calls; all
simulation state lives client-side and is persisted to `localStorage`.

Three ways to run it, one router:

| Mode | Command | Persistence |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=boids` | in-memory `StatusStore` |
| .iwft | `pnpm test --filter=boids` | in-memory `StatusStore` |
| production | `pnpm build && pnpm start` | in-memory `StatusStore` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + a
process-liveness `/health`). See [`CLAUDE.md`](CLAUDE.md) for layout, commands,
and scoped rules.
