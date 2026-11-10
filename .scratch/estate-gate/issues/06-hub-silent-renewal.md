# 06 - hub: an expired family token renews without a screen

**Status:** resolved
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

- 2026-11-10 (implementer): built on `estate-gate/tracker` with ticket 05 in it.
  **Stopped on the session lifetime, as the ticket says.** Better Auth's session
  is its default 7 days (`betterAuth.ts` sets no `session` option), shorter than
  the family token's 30. Worse, the browser cookie does not slide: identity calls
  go through tRPC, `resolveParentId` uses `auth.api.getSession` server-side, and
  the refreshed `Set-Cookie` is dropped (checked in the docker stack: the row's
  expiry slid, no `Set-Cookie` on `identity.me`). So renewal works only for 7 days
  after a parent's sign-in. Recorded in ADR 0095 decision 12; nothing changed.
- Deviations: renewal is tried only on arrival, not after a sign-in on the page
  (ADR 0095 decision 11). A remembered profile that `children.list` no longer
  returns is not forgotten, only fallen through. The loop-guard iwft seeds the
  first renewal's `sessionStorage` record rather than driving a real app bounce,
  which the CT harness cannot load. Ticket 05's review leftovers (`iat` read-back,
  same `returnTo`, trailing slash, shared link hidden when signed in) are fixed
  here with tests.
