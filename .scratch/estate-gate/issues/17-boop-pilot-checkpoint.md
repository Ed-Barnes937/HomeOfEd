# 17 - Pilot the gate on boop, then let the other apps through

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 03, 05, 06, 10

Ed's check on production once boop's gate has deployed:

- A signed-out browser opening `boop.homeofed.com` lands on `/account`, and
  after sign-in and a pick lands back on boop.
- Two profiles on one tablet see their own boops; the boops that were already
  on the tablet appear for both.
- A `/shared#g=...` link opens in a private window with no account, plays, and
  leaves nothing behind. An old `/#g=...` link offers "Open what was shared".
- A boop saved as one profile on one device appears on another device.
- `/account` shows the last-saved line once ticket 08 is in.

If it holds, merge tickets 11-15 (one deploy each; the smoke now accepts the
`302`). Rollback for any app is removing `FAMILY_ACCOUNT_URL` from its
`fly.toml`.

## Comments
