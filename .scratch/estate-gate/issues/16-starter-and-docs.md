# 16 - starter template and the adding-an-app procedure are gated by default

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 3, 5
Blocked by: 01, 02

A new app copied from `templates/starter` should arrive gated.

- `templates/starter`: wire `familyDocumentGate` in `main.ts` behind
  `FAMILY_ACCOUNT_URL`, set it in the template `fly.toml`, and note it in the
  template's `CLAUDE.md`.
- `docs/how-to/adding-an-app.md`: a step for the gate (add the app to
  `ESTATE_APPS`, the `fly.toml` line, the compose line, and the `/shared`
  convention if the app has share links) and the per-profile save helper for
  apps that save work.
- Root `CLAUDE.md` "Adding an app" checklist: one item pointing at that step.
- **CI copy base.** Root `CLAUDE.md` and `docs/how-to/adding-an-app.md` tell a
  new app to copy the `deploy-hub` job. Hub is never gated and keeps a strict
  200-only smoke (ticket 03), so a gated app copying it fails its first deploy
  after Fly has already rolled out. Point both at an estate app's job (boop's)
  instead.
- **`scripts/go-live.sh`** has its own index smoke (`curl -fsS
  "https://$HOST/" | grep '<div id="root">'`, around line 210). Make it accept
  what ticket 03's estate smoke accepts: the 200 index, or a `302` to
  `https://homeofed.com/account?returnTo=`. Test the shell against a throwaway
  local server in both modes; do not run the script against real
  infrastructure.

## Comments

- 2026-11-10 (implementer): built on `estate-gate/16-starter-and-docs`, stacked
  on 19 (`familyDocumentGateFromEnv`). Differences from the text above:
  - `main.ts` makes the single `familyDocumentGateFromEnv` call (orchestrator
    override) with `publicPaths: []`: the starter has no share links, and
    ungating `/shared` would serve its SPA shell to anyone. A comment says to
    add `'/shared'` with share links.
  - New `templates/starter/src/server/main.test.ts` spawns the real entrypoint
    on a real port: ungated without `FAMILY_ACCOUNT_URL`, `302` with it, and a
    valid family cookie passes. Copied apps inherit it. The built image was
    also run by hand: `200` ungated, `302` gated, and on Fly (`FLY_APP_NAME`)
    it refuses to boot with the test key or with no key.
  - The how-to's compose row named a `starter` compose service that does not
    exist; it now says to copy boop's. It also tells the reader to drop the
    `FAMILY_ACCOUNT_URL` line while `PRODUCTION_FAMILY_PUBLIC_KEY` is `null`.
  - `deploy.yml`'s header comment also said to copy `deploy-hub`; it now says
    `deploy-boop`, like the root `CLAUDE.md` and the how-to.
  - `go-live.sh`: the index check is now an `index_smoke` function, accepting
    what the CI estate smoke accepts, so it could be tested alone against a
    throwaway local server (index, gate `302`, wrong host, wrong path, no
    `returnTo`, `500`, `404`, `200` without the root div, refused connection).
  - Root `CLAUDE.md`: the DB-only items renumber to 9 and 10, and the em dashes
    on the lines touched became plain dashes.
