# 05 - hub: `/account` returns the visitor to where they were going

**Status:** resolved
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

**2026-11-10 (implementer).** Built, with these differences (ADR 0095):

- **Not built: "an already-live family session returns immediately".** The gate
  only redirects when it cannot verify a token, so a visitor reaching hub with a
  token hub can decode came from an app's switch-player link (decision 10) or
  from a gate/hub disagreement (ticket 19's wrong-key loop, clock skew). An
  immediate return makes switching player impossible and, in a disagreement,
  spins between app and hub with no screen. Instead the page shows and any pick
  returns. The no-screen case for a signed-in parent is ticket 06's renewal.
  Open call for Ed.
- `returnTo` and the fragment come from the arrival URL, captured in memory at
  module load because TanStack Router rewrites the address bar on mount (and
  decodes the fragment). Re-vetted by `safeReturnTo` at use; no storage.
- The return uses `location.replace` and happens only when the cookie reads back
  with the picked `sub`.
- "Open what was shared" shows whenever nobody is signed in, including while
  family is loading or down, not only on the signed-out card.
- **Checked 2026-11-10** (ADR 0095, "What was checked"): a fragment survives a
  real `302` in Playwright WebKit and Chromium; hub's production build in the
  docker stack returns to boop byte for byte. Boop's own gate (tickets 02, 10)
  did not exist yet, so that `302` was a test server's.
- Found for tickets 10-15: each app's own router decodes its fragment on mount
  (`%7B` becomes `{`), so an app reading its share payload after mount sees the
  decoded form.
