# inksplat

A calm, single-screen, fully client-side canvas doodling toy: procedurally-
generated ink blots on warm paper that the user draws on and turns into little
creatures with freehand lines and stamped eyes. No accounts, no backend data,
no gamification. Lives at `inksplat.homeofed.com`.

Full spec: [`.claude/tasks/inksplat-doodle/spec.md`](../../.claude/tasks/inksplat-doodle/spec.md) ·
ratified decisions: [`.claude/tasks/inksplat-doodle/decisions.md`](../../.claude/tasks/inksplat-doodle/decisions.md) ·
divergences from the design guide: [ADR 0016](../../docs/adr/0016-inksplat-doodle.md).

**No database** — see [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
The layered backend skeleton (tRPC → handler, no Store) exists only for
platform convention and `/health`; the frontend makes no tRPC calls and all
drawing state lives client-side. The one exception: the *current* drawing is
mirrored to `localStorage` (`src/features/doodle/session.ts`) so an accidental
reload doesn't lose it — never a gallery of past work.

## Run it

```
pnpm dev --filter=inksplat
```

Simulator mode: frontend + the real tRPC router on port **3006**, no
persistence, HMR. Restart to pick up server-side changes.

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=inksplat` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=inksplat` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). No database, no migrations.

## The command loop

Everything drawn lives as an ordered list of immutable ops
(`field` / `stroke` / `eye`) in `features/doodle/engine/history.ts`; the canvas
is a projection of that list, replayed by `render/surface.ts`. `useDoodle.ts`
is the integration keystone — it owns the canvas lifecycle, pointer handling,
history, session restore, the bloom-in animation, and save/share, and exposes
`newPage()` / `undo()` / `save()` plus `tool`/`nib` state to `DoodlePage.tsx`.
See [`CLAUDE.md`](CLAUDE.md) for the full layout map, commands, ports, and
scoped rules.
