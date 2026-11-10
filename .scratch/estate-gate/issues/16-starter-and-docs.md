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

## Comments
