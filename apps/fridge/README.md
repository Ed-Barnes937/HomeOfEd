# fridge

A single-screen fridge door covered in draggable letter/number/fraction
magnets that physically bump and shove each other while dragging. Lives at
`fridge.homeofed.com`. Design reference:
[`docs/reference/fridge-magnets/`](../../docs/reference/fridge-magnets/);
full spec and implementation plan:
[`docs/plans/0003-fridge-implementation-plan.md`](../../docs/plans/0003-fridge-implementation-plan.md).

**Database-backed as of phase 3** — see
[ADR 0010](../../docs/adr/0010-shared-fridge-boards.md). *Personal* boards
(magnets, finish, kitchen light, saved fridges) still live only in the
browser's `localStorage` (`fridge:v1`) — see `features/board/serialize.ts`.
The DB holds one thing: *shared* boards, immutable anonymous snapshots in
Postgres under a 10-char id. The Store seam (`FridgeStore` — `ping`,
`insertSharedBoard`, `getSharedBoard`) and a deep `/health` are wired now; the
share/get handlers land in F11 and the share/import UI in F12, so the frontend
still makes no tRPC calls yet. The collision/placement/rotation engine is the
standalone [`@hoe/magnet-kit`](../../packages/magnet-kit/README.md) package.

Three ways to run it, one router:

| Mode | Command | Server persistence |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=fridge` | Node-side PGlite (fresh each start) |
| .iwft | `pnpm test --filter=fridge` | in-browser PGlite (fresh each test) |
| production | `pnpm build && pnpm start` | real Postgres (`DATABASE_URL`) |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + a deep
`/health` that round-trips the Store to Postgres). Migrations run once per
deploy via `pnpm migrate` (the fly.toml `release_command`); schema changes go
through `pnpm generate --filter=fridge`. See [`CLAUDE.md`](CLAUDE.md) for
layout, commands, and scoped rules.
