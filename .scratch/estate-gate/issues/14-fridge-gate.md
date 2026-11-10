# 14 - fridge: the gate, with shared boards left public

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 5, 7
Blocked by: 01, 02, 10 (merge after 17)

fridge is database-backed and already shares boards at `/b/$id`
(`src/features/share/SharedBoardRoute.tsx`).

- Gate wiring in `main.ts` with `publicPaths: ['/b/']`, and
  `FAMILY_ACCOUNT_URL` in `fly.toml`. Confirm the tRPC calls the shared board
  makes need no session (the gate does not cover `/api`).
- Establish what `useFridgeBoard` keeps in `localStorage`. If it is the
  device's own board or a pointer to it, scope it per profile through
  `profileScopedKey` with legacy adoption; `fridge:landscape-nudge` is a
  device preference and stays unscoped. If a shared-board visitor would write
  to that storage, stop it (spec decision 6).
- A switch-player link to `accountUrl(<current URL>)`.
- iwft for whatever was scoped; a real-port test that `/b/<id>` is served
  without a session. Not `compose.yml` or `deploy.yml`. Update
  `apps/fridge/CLAUDE.md`.

## Comments

**2026-11-10, built.** Differences from the text above, and why:

- **What fridge keeps.** `fridge:v1` holds the board's content (current board
  and saved fridges), not a pointer to a server board. Server-side, shared
  boards are immutable anonymous snapshots: anyone with an id can read one,
  nobody can write one. So per-profile scoping with legacy adoption gives each
  profile its own copy, and no profile can overwrite another's. Scoped through
  `profileStorage` (`features/board/profileKeys.ts`), built once in
  `pages/PlayerLayout.tsx` with `reloadOnPlayerChange`. The landscape nudge is
  sessionStorage and stays the device's.
- **Gate wiring** follows the orchestrator: `publicPaths: ['/b']` (whole
  segment, so `/b/<id>` is public and `/bx` is not), `fly.toml` untouched. The
  call sits in a one-line `server/documentGate.ts` that `main.ts` passes, so
  the real-port test exercises the same config.
- **`/b/<id>` no longer imports on open** (spec decision 6). It opens the board
  to play with over `memoryStorage`, for anyone, signed in or not, with
  "Keep this fridge" in place of Save, New and the saved fridges. Keep is a
  plain link to `/keep/<id>`, a page load the gate sees, which does the old
  import into the player's storage and goes home. ADR 0010 amended; ADR 0093
  decision 5 notes it. Keep keeps the snapshot as shared, not the visitor's
  edits (open question in the PR).
- **Switch player** is a "playing as <name>" chip in the top bar (a menu entry
  on the phone), linking to `switchPlayerUrlFor`. Shown only with a session,
  and not on `/b`. The back arrow moved to `hubUrlFor`; `hubUrl.ts` is gone.
- `scripts/docker-stack-gate-round-trip.mjs` gained `SHARED_PATH` (default
  `/shared`), for fridge's `/b/<id>`.

