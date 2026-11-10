# 03 - CI smoke understands a gated app; compose carries the account URL

**Status:** ready-for-agent
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
