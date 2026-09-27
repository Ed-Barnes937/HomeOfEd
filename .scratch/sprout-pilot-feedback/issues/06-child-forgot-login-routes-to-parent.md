# 06 - Child "forgot password or PIN" routes to a parent sign-in

**What to build:** A child who has forgotten their password or PIN has no way
in from the child login screen. The parent-side recovery already exists
(`children.resetPin`, [ADR 0037](../../../docs/adr/0037-sprout-pin-reset-clears-never-chooses.md),
ticket 02) but only if the parent already knows to go to that child's settings
page. Add a child-facing "forgot" entry point that hands off to a signed-in
parent, lands them on the reset for that child, and hands the device back to
the child afterwards. Only a signed-in parent can perform the reset - no server
change to who is allowed to reset.

**Blocked by:** None.

**Status:** done

- [x] `ChildLoginPage`: a "Forgot your password or PIN?" link on both the PIN
      screen and the username/password screen.
- [x] The link opens a child-facing "Ask a grown-up to help" screen with a
      "Grown-up: sign in" button (not a direct jump to the parent login form).
- [x] The button goes to `/parent/login?redirect=...`:
      - child known (picked from the device profile list, so the id is already
        on the device) → `redirect=/parent/children/<id>?reset=1`
      - child unknown (username/password screen) → `redirect=/parent/children`.
        Do not resolve a typed username to a child id before a parent signs in
        (username enumeration).
- [x] `ParentLoginPage` route gets `validateSearch` for `redirect`, accepting
      only internal paths starting with `/parent/` (reject absolute URLs,
      `//host`, anything else); fall back to `/parent/dashboard`.
- [x] `useRequireParent` passes the current `/parent/...` path as `redirect`
      when it bounces to login, so every parent screen returns you where you
      were.
- [x] `ChildSettingsPage`: `?reset=1` opens the existing reset confirmation
      already expanded. The parent still has to confirm; nothing resets on its
      own. If the child isn't this parent's (ownership check fails), fall back
      to `/parent/children` rather than an error.
- [x] After a successful reset, show a "Hand back to <child>" button linking to
      `/child/login?child=<id>` (the existing deep link; `establishChildSession`
      signs the parent out, and a PIN-less child is routed to username/password
      login).
- [x] Copy: rename the "Reset PIN" card to "Reset password & PIN" (it resets
      both, per ADR 0037).
- [x] Tests: one `child-flows.iwft.tsx` journey (child taps forgot → grown-up
      screen → parent signs in → lands on expanded reset → confirms → hands
      back → child logs in with username/username → forced password + PIN
      change); a unit test for the redirect sanitiser (external URL, `//evil`,
      non-`/parent/` path, valid path).
- [x] ADR for the `redirect` search param + the grown-up interstitial, related
      to ADR 0037.

## Comments

**2026-09-27 (Ed):** Want a password reset button for a parent's child; only a
signed-in parent does the reset, and a child clicking it should be routed to a
parent's login.

**2026-09-27 (agent):** Explored and agreed with Ed: the server-side reset
already exists (ADR 0037), so this is the child entry point + a safe
post-login redirect + a hand-back. Chosen over alternatives: an interstitial
screen rather than dropping a child straight onto a parent login form, and
`?reset=1` opens the confirm already expanded rather than only scrolling to it.
