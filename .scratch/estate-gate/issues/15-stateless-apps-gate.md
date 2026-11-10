# 15 - wotd, karesansui, boids: the gate

**Status:** ready-for-agent
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
