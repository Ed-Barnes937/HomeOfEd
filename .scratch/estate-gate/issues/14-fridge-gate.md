# 14 - fridge: the gate, with shared boards left public

**Status:** ready-for-agent
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
