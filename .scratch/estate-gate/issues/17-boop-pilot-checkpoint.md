# 17 - Pilot the gate on boop, then let the other apps through

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 25 (the key, and boop's one-line PR)

Ed's check on production once boop's gate has deployed:

- A signed-out browser opening `boop.homeofed.com` lands on `/account`, and
  after sign-in and a pick lands back on boop.
- Two profiles on one tablet see their own boops; the boops that were already
  on the tablet appear for both.
- A `/shared#g=...` link opens in a private window with no account, plays, and
  leaves nothing behind. An old `/#g=...` link offers "Open what was shared".
- A boop saved as one profile on one device appears on another device.
- `/account` shows the last-saved line once ticket 08 is in.

If it holds, turn the gate on for the other apps (ticket 25: one line in each
`fly.toml`; the smoke accepts the `302`). Tickets 11, 13, 14 and 15 are
already in the epic PR with the gate off. Rollback for any app is removing
`FAMILY_ACCOUNT_URL` from its `fly.toml`.

## Comments
