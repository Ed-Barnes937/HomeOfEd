# 06 - hub: an expired family token renews without a screen

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 11
Blocked by: 05

Family tokens live 30 days and nothing renews them, so a gated child would
meet a parent-password wall every month.

- On each pick, remember the picked account id on this device (hub
  `localStorage`; clear it on sign-out, household erase, and when that profile
  is deleted).
- Arriving with a valid `returnTo`, no family token, a live parent session
  (`identity.me`) and a remembered profile that `children.list` still returns
  (or the parent themself): `mintSessionToken`, write the cookie, return. No
  screen is shown; any failure falls through to the normal page.
- First step of the ticket: find Better Auth's session lifetime as configured
  in `apps/family` and record it in ADR 0095. If it is shorter than the family
  token's 30 days, say so in the PR and stop for Ed before changing it.
- **Loop guard.** If an app's gate refuses the token hub just minted (a key
  mismatch, clock skew), the visitor arrives straight back and a second silent
  renewal would bounce them between app and hub with no screen. Renew silently
  at most once per `returnTo` in a short window (`sessionStorage`, a minute);
  a second arrival inside it shows the normal page.
- Renewal applies only when there is **no** family token. Arriving with a live
  one is an app's switch-player link (ticket 05, ADR 0095): show the picker.
- Call ticket 05's `returnToApp()` (`features/account/returnTo.ts`) after the
  mint; do not build a second return path.
- iwft: renewal bounce, deleted-profile fallthrough, signed-out fallthrough,
  the loop guard, and a live token showing the picker.

## Comments
