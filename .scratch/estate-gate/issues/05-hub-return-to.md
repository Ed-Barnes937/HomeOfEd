# 05 - hub: `/account` returns the visitor to where they were going

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 4, 6
Blocked by: 01

`apps/hub/src/pages/account/`. The gate sends visitors here with
`?returnTo=<url>` and, carried by the browser, the original fragment.

- Read `returnTo` through `safeReturnTo` (`allowLocal` only when hub is on
  localhost). A rejected value is dropped silently and the page behaves as
  today.
- After a profile is picked and the family cookie is written, navigate to
  `returnTo` with the fragment reattached. Sign-in and registration keep the
  `returnTo` alive until the pick.
- ~~Arriving with a valid `returnTo` and an already-live family session
  returns immediately.~~ Withdrawn 2026-11-10: that state is an app's
  switch-player link, so the picker shows and any pick returns (ADR 0095).
- Signed out, with a valid `returnTo` and a fragment: the signed-out card also
  offers "Open what was shared", linking to `sharedUrl(returnTo, fragment)`.
- iwft (state through UI, `FakeFamilyClient`): pick-then-return, fragment
  survives, hostile `returnTo` ignored, shared hand-off link. Unit tests stay
  in ticket 01 for the URL rules.
- Real-browser check in the docker stack (`family hub boop`) that a fragment
  survives the server `302`; record the result in the PR.
- ADR 0095 (hub return and renewal); amend ADR 0081.

## Comments
