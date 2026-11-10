# 03 - CI smoke understands a gated app; compose carries the account URL

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 2, risks

The only ticket that edits `.github/workflows/deploy.yml` and `compose.yml`.
App tickets must not touch either file.

- **Smoke.** Each deploy job's post-deploy smoke fetches `$APP_URL/` and greps
  the index for an asset. For a gated app `/` answers `302`. Make the smoke
  accept either shape: `200` with the existing asset check, or `302` whose
  `Location` starts with `https://homeofed.com/account?returnTo=`. `/health`
  stays the first check in both. Apply to every job; do not key it on an app
  list, so turning a gate on or off needs no workflow change.
- **Compose.** Add `FAMILY_ACCOUNT_URL=http://localhost:<hub compose port>/account`
  to the service of every app in `ESTATE_APPS` (spec decision 3 lists the
  exempt ones). Harmless until each app's ticket wires the gate.
- Note in `README.md`'s docker-stack section that the stack is gated and a
  sign-in needs `docker compose up family hub <app>`.

## Comments

- The gate-aware smoke is in every job that smokes `/`: the 8 estate apps,
  hub, family, and record-deploys' hub redeploy. Hub and family can never be
  gated, but hub is the copy base for new apps, so one shape everywhere. The
  sprout smoke (asserts the 451 geo boundary) and sprout-pipeline (no public
  smoke) are unchanged. Family's `200` branch keeps its root-div-only check,
  as before.
- The `302` must be exactly `302`, and the `Location` must start with
  `https://homeofed.com/account?returnTo=`; anything else fails the smoke.
- Open: in the docker stack hub's `/account` talks to family at
  `localhost:3012` (`familyService.ts`), but compose publishes family on 8092,
  and the family image's CORS allows only `https://homeofed.com` under
  `NODE_ENV=production`. By reading the code, a sign-in through the stack will
  not reach family until that is resolved; tickets 05 and 10 rely on a
  `family hub boop` round trip.
