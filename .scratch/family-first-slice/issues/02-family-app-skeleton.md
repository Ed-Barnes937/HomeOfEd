# 02 - `apps/family` skeleton + touchpoints + architecture ADR

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md) §4 intro, §9, §10
Blocked by: none

Stand up the app shell with every wiring touchpoint, no domain logic yet.
Copy base `templates/starter` per `docs/how-to/adding-an-app.md` §1.

- `apps/family`, package `@hoe/family`. SPA is the minimal placeholder page
  ("family service - manage your family at homeofed.com/account"); all real
  UI is hub's (decision 5, hard rule 2).
- **Ports:** dev **3012**, CT **3112**, compose host **8092** - claim the
  registry row and bump next-free to 3011/3111/8091 in the same PR; check
  unmerged branches first (karesansui/hirameki collision precedent).
- **fly.toml:** app `hoe-family`, lhr, shared-cpu-1x / 512MB,
  `min_machines_running = 0`, `release_command = 'node src/server/migrate.ts'`
  (the release command lands with ticket 03's migrate.ts - stub or sequence
  accordingly). Writing the file only; `fly apps create` is human-gated
  (ticket 08).
- **CI:** copy `deploy-hub` as `deploy-family`, gated on a `FAMILY_GO_LIVE`
  repo variable (the `SPROUT_GO_LIVE` precedent) so merges are safe before
  the Fly app exists.
- **compose.yml:** hub two-service pattern - `family` (host 8092) +
  `family-db` (postgres:17, `family-db-data` volume). 8092 expected clean of
  the 8082/8083 squatter quirk.
- Scoped `apps/family/CLAUDE.md`; `CONTEXT-MAP.md` entry;
  `.env.example` with dev-insecure defaults (sprout-style).
- **Architecture ADR** (spec §10, lands with this first family PR):
  `docs/adr/NNNN-family-service.md` (next free number, check all branches) -
  fresh family service + central SaveStore + browser-direct wiring + Ed25519
  token mechanism, citing map ticket 05; records the opaque-blob discipline
  ("the server never parses `blob`") and the `slotKey` = localStorage-key
  convention. This is the ADR 0008 deferred "separate future ADR".

Verify: starter-level tests green, docker-stack builds, smoke `/health`
(shallow is fine until ticket 03 adds the DB).

## Comments

- 2026-09-28: **built** on branch `family-app-skeleton` (off main, not the old
  `family-first-slice` branch, which had diverged after ticket 01 squash-merged
  as PR #161).

  **What landed.** `apps/family` copied from `templates/starter` with every
  touchpoint changed: package `family`, dev 3012, CT 3112, compose 8092,
  `fly.toml` app `hoe-family`, and the Dockerfile repointed. Root wiring: the
  port registry row plus a bumped next-free (3011/3111/8091), the `family` +
  `family-db` compose services, a `deploy-family` CI job gated on
  `FAMILY_GO_LIVE`, and a `CONTEXT-MAP.md` entry. The architecture ADR is
  [0070](../../../docs/adr/0070-family-service.md), written as Accepted because
  it records the decisions Ed already took at the 2026-09-10 sitting.

  **Ports and ADR number re-checked at build time.** 3010/3110/8090 was still
  unclaimed on every remote branch. The ADR number had moved a long way from
  what the epic assumed: main was already at 0069, so this is 0070, not 0058.

  **Two things deliberately deferred to ticket 03.** `fly.toml` has no
  `release_command` and compose has no `migrate.ts &&` prefix, because
  `src/server/migrate.ts` does not exist yet and a deploy would fail on it.
  `family-db` is in compose already so the stack shape is settled. `/health`
  stays a shallow liveness check for the same reason.

  **The starter's `greeting` route is kept as a smoke**, which the how-to
  explicitly sanctions, so the layered path stays exercised until the identity
  and save routers arrive. Its strings are now family's.

  **Verify.** `pnpm lint` and `pnpm typecheck` green across all 19 workspace
  tasks; `pnpm --filter family run test` green (2 vitest, 3 iwft). The docker
  stack could NOT be built: the Docker daemon is not running on this machine.
  As a substitute the production entrypoint was run directly
  (`PORT=8090 node src/server/main.ts`): `/health` returned `{"ok":true}`, the
  SPA served with `<title>family</title>` and its root div, and
  `/api/trpc/greeting` returned the handler's value over real HTTP.
  `docker compose config` resolves both new services. **The docker-stack build
  remains unverified and needs a run once Docker is up.**

- 2026-11-09: **docker-stack verified**, closing the one gap the build comment
  left open. With the daemon up, `docker compose build family` succeeded and
  `docker compose up family` brought up `family` alongside a healthy
  `family-db`. Smoked against the real image on host 8090: `/health` returned
  `{"ok":true}`, the SPA served `<title>family</title>`, and
  `/api/trpc/greeting` returned `hello from the family service`. Ticket 02's
  verify line is complete.

- 2026-11-09: **ports moved.** Armoury landing on main took 3011/3111/8091 and
  moved the next-free row to 3012/3112/8092. The 3010/3110/8090 row on main now
  belongs to orbi's in-flight claim, so family's claim moves to dev **3012**, CT
  **3112**, compose host **8092**, and the registry in `adding-an-app.md` lists
  it below armoury. Every reference was updated (package script, `ctPort`,
  `.env.example`, CORS dev origins, boop's localhost fallback, compose). The
  earlier comments above record what was run at the time, on the old ports.
