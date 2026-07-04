# apps/fridge — scoped rules

A single-screen fridge door covered in draggable letter/number/fraction
magnets that physically bump and shove each other while dragging, at
`fridge.homeofed.com`. **Database-backed as of phase 3**
([ADR 0010](../../docs/adr/0010-shared-fridge-boards.md)): shared boards are
immutable anonymous snapshots in Postgres. Personal boards stay in
localStorage — only *shared* boards touch the DB
([plan §5/§8](../../docs/plans/0003-fridge-implementation-plan.md)). The DB
layer, the `board.share`/`board.get` handlers, and the share/import UI
(`features/share/` + the `/b/$id` route) are all in — the frontend now makes
tRPC calls via `src/trpcClient.ts`. Visual
reference: `docs/reference/fridge-magnets/`
(read its `README.md` before touching anything visual or interactive —
layout, tokens, magnet recipes, and collision feel are meant to match the
handoff closely, per the plan's §1/§2).

The collision/placement/rotation maths lives in `packages/magnet-kit`
(`@hoe/magnet-kit`) — pure TS, no React/DOM. **The engine boundary is the
package**: no collision math in this app, call the package's functions.

## Layout

Target shape ([plan §7](../../docs/plans/0003-fridge-implementation-plan.md)).
Phases 1–2 (engine through F6), the F10 DB wiring, the F11 share/get handlers,
and the F12 share/import UI are all done:

```
src/
  server/                     health + shared-board persistence (ADR 0010)
    boardSchema.ts            zod storedBoardSchema — shared by client+server
    idGen.ts                  randomShareId — crypto-random 10-char base62
    schema.ts                 Drizzle schema (shared_boards); FridgeSchema type
    migrations/               drizzle-kit output (`pnpm generate`) — committed
    migrations.ts             Vite ?raw glob loader → statement list (browser/vitest)
    migrate.ts                release_command: run-once migrations (migratePostgres)
    store.ts                  FridgeStore interface + DrizzleFridgeStore
    store.test.ts             DrizzleFridgeStore over PGlite + generated migrations
    handlers/healthHandler.ts
    handlers/shareBoardHandler.ts  id-gen + insert-conflict retry (ADR 0010)
    handlers/getBoardHandler.ts    fetch + re-validate on the way out
    router.ts  simulator.ts  main.ts   # board.share mutation, board.get query
  features/board/             model.ts, serialize.ts, useFridgeBoard.ts (engine
                               wiring + persistence), FridgeDoor, MagnetView,
                               SelectionOverlay
  features/tray/               Tray, Tabs, PaletteGrid, ColorPicker, AppearanceColumn
  features/toolbar/           TopBar (name/Save/New/Clear + share slot), SavedChips
  features/share/             ShareButton, SharedBoardRoute (/b/$id), boardApi,
                               importSharedBoard (import-on-open glue)
  pages/FridgePage.tsx        composes the door/tray/toolbar
  styles/tokens.scss          ported from the handoff's tokens.css
  trpcClient.ts               the app's only tRPC caller (share/import)
  testing/                    IwftApp, FridgePagePom, iwftTest
  fridge.iwft.tsx  share.iwft.tsx
  router.tsx                  '/' + '/b/$id' (share import → redirects to '/')
```

Persistence (F6): `features/board/serialize.ts` holds the seed board, the
`StoredBoard`↔`Magnet` mapping, and `loadState`/`saveState` (both take a
`Pick<Storage, 'getItem'|'setItem'>` — the caller passes `window.localStorage`,
tests pass a fake, same DI pattern as boids' `settings.ts`).
`useFridgeBoard` loads once on mount and writes `fridge:v1` on every mutation
(magnets, finish, wall, or name) via a `useEffect`.

## Commands

- `pnpm dev --filter=fridge` — simulator mode on port **3002** (real router +
  Node-side PGlite via Vite middleware; restart to pick up server changes).
- `pnpm test --filter=fridge` — Vitest (`*.test.ts`) then Playwright CT
  (`*.iwft.tsx`).
- `pnpm generate --filter=fridge` — drizzle-kit migration from schema changes
  (`--custom` for hand-written SQL); commit the whole output folder.
- Prod (container/release): `pnpm build` then `pnpm start` (needs
  `DATABASE_URL`, see `.env.example`; default port 8080); `pnpm migrate` is the
  deploy-time release_command.

## Rules

- **Engine/app boundary:** all collision/placement/rotation maths is
  `@hoe/magnet-kit` — the app owns magnet types/sizes/colours, serialisation,
  React state, and persistence (plan §3/§5), and calls the package's
  functions rather than reimplementing them.
- Visual work recreates `docs/reference/fridge-magnets/` pixel-close — read
  its `README.md` first; port token *values* from its `styles/tokens.css`
  into `src/styles/tokens.scss`, don't copy the file verbatim.
- **Database (ADR 0010).** The `Store` type parameter is `FridgeStore`
  (`store.ts`) — `ping`, `insertSharedBoard`, `getSharedBoard`. Handlers
  depend on the interface; "real vs simulator" is just the injected
  `DbClient`'s driver (Postgres in prod, PGlite in dev/.iwft/vitest).
  `/health` is a deep Store round-trip. The frontend's only tRPC calls are
  `board.share`/`board.get` via `src/trpcClient.ts` (share/import); the fridge
  board itself stays in localStorage.
- **Share/import (ADR 0010).** `features/share/`: **Share** (toolbar slot next
  to Save, ghost style, enabled when the board has ≥1 magnet) publishes the
  current board and shows a `${origin}/b/<id>` link (copied to the clipboard
  when allowed); the **`/b/$id`** route fetches the snapshot and imports it as a
  new local fridge named `"<name> (shared)"` — `importSharedBoard.ts` writes it
  to localStorage as both the `current` board and a saved chip (upserted by
  name, matching Save; preserving the visitor's other saves), then redirects to
  `/`, where it shows current with its chip active. An unknown/typo'd id shows
  the not-found state. Deep-linking `/b/<id>` works because `createAppServer`
  serves `index.html` for non-API GET/HEAD (SPA fallback — no backend change).
- Migrations are loaded two ways on purpose: `migrations.ts` (Vite `?raw`
  glob) for the .iwft browser bundle and vitest; `@hoe/db/node`'s fs loader
  for native-Node contexts (dev simulator, prod migrate). Schema changes touch
  only `schema.ts` + `pnpm generate`.
- Server code changes go through TDD: unit test against a Store fake first
  (`health.test.ts`), `store.test.ts` exercises real SQL over PGlite, and
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks
  to erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts`/`migrate.ts` run
  under native Node.
- Ports: dev 3002, CT 3103 (hub 3000/3100, starter 3001/3101, boids 3001/3102)
  — a copied app must pick fresh ones (root `CLAUDE.md` checklist).
