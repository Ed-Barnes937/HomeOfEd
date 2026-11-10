# 16 - starter template and the adding-an-app procedure are gated by default

**Status:** ready-for-agent
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
