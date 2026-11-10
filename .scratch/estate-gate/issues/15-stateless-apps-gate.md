# 15 - wotd, karesansui, boids: the gate

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 7
Blocked by: 01, 02, 10 (merge after 17)

These three keep only device preferences in `localStorage` (theme, sim and
garden settings), which stay unscoped. Gate wiring only.

- In each app's `main.ts`, pass `familyDocumentGate` (no public paths) when
  `FAMILY_ACCOUNT_URL` is set, and add the variable to each `fly.toml`.
- Before wiring, confirm each app really has no saved work and no share link.
  If one does, leave that app out and note it here for a ticket of its own.
- One real-port test per app is not needed; ticket 02 owns the gate's
  behaviour. A typecheck-level wiring is enough.
- Not `compose.yml` or `deploy.yml`. One line in each app's `CLAUDE.md`.

## Comments

- 2026-11-10 (implementer): wotd and boids are wired; **karesansui is left out**.
  - Storage audit. wotd: `wotd-theme` (light/dark) in localStorage, the
    `?level=` search param (which difficulty to show, not a payload), and a
    Postgres table of the day's generated words shared by everyone (nothing per
    visitor). boids: `boids:settings:v1` (theme, shape, cursor glyph, sim
    sliders). Neither has saved work or a share link.
  - karesansui keeps `karesansui:presets:v2` (and the v1 key it migrates from):
    up to eight gear trains the visitor saves, renames and deletes. That reads
    as saved work rather than a device preference, so per the orchestrator it
    is out of this ticket until Ed or the orchestrator decides whether presets
    are per profile.
  - Deviations, by orchestrator override: no `FAMILY_ACCOUNT_URL` in any
    `fly.toml` (the production key is not committed yet); each app gets the
    starter's real-port `src/server/main.test.ts` (wotd's with an unreachable
    `DATABASE_URL`, as the how-to's §2 says); the hand-rolled `hubUrl.ts`
    (always `localhost:3000` locally, wrong on compose ports) is replaced by
    `hubUrlFor` from `@hoe/accounts`, so the `.iwft` back link now expects
    production hub on the CT port.
  - Not run: the full-stack `scripts/docker-stack-gate-round-trip.mjs`, which
    has no option for an app without `/shared` on this branch.
