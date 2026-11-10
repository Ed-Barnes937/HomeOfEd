# 13 - espy: per-profile doodles and the gate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 3, 7, 8, 10
Blocked by: 01, 02, 10 (merge after 17)

- Scope the doodle save (`src/features/doodle/useDoodle.ts`, `save.ts`) per
  profile through `profileScopedKey`; `adoptLegacyDocument` on first open. If
  doodles are large, apply ticket 12's measure-first rule and report.
- The Capacitor shell loads bundled assets and has no family cookie: a null
  session keeps the unscoped key, so the native app behaves exactly as today.
  Add a test that pins this.
- `save.ts` references `location.hash`; establish whether espy has a share
  link at all. If it does, give it a `/shared` route as in ticket 10; if not,
  say so in the PR and add no public path.
- A switch-player link to `accountUrl(<current URL>)`, hidden in the native
  shell.
- Gate wiring in `main.ts` and `FAMILY_ACCOUNT_URL` in `fly.toml`. Not
  `compose.yml` or `deploy.yml`. Update `apps/espy/CLAUDE.md`.

## Comments
