# 02 - `apps/family` skeleton + touchpoints + architecture ADR

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §4 intro, §9, §10
Blocked by: none

Stand up the app shell with every wiring touchpoint, no domain logic yet.
Copy base `templates/starter` per `docs/how-to/adding-an-app.md` §1.

- `apps/family`, package `@hoe/family`. SPA is the minimal placeholder page
  ("family service - manage your family at homeofed.com/account"); all real
  UI is hub's (decision 5, hard rule 2).
- **Ports:** dev **3010**, CT **3110**, compose host **8090** - claim the
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
- **compose.yml:** hub two-service pattern - `family` (host 8090) +
  `family-db` (postgres:17, `family-db-data` volume). 8090 expected clean of
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
