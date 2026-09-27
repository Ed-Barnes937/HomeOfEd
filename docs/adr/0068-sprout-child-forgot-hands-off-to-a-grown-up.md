# 0068 - sprout: a child's "forgot" hands the device to a grown-up, and parent login takes a sanitised `redirect`

- **Status:** Accepted
- **Date:** 2026-09-27
- **Related:** [ADR 0037](0037-sprout-pin-reset-clears-never-chooses.md) (the
  parent-side reset this routes to), [ADR 0012](0012-sprout-app-owned-auth.md)
  (the two-identity auth seam), pilot-feedback ticket
  (`.scratch/sprout-pilot-feedback/issues/06-child-forgot-login-routes-to-parent.md`).

## Context

ADR 0037 gave a parent a full credential reset on the child's settings page,
but a child stuck on the login screen had no way to reach it: nothing on the
child side mentioned it, and the parent had to know where to look. Only a
signed-in parent may reset, and that must not change.

## Decision

**The child login screen offers "Forgot your password or PIN?", which opens a
child-facing "Ask a grown-up to help" interstitial whose one action is
"Grown-up: sign in". That goes to `/parent/login?redirect=...`, and after the
reset the parent gets a "Hand back to <child>" link to `/child/login?child=<id>`.**

- **Interstitial, not a direct jump.** A child dropped onto a bare parent login
  form reads it as "my login is broken"; the interstitial tells them to fetch a
  grown-up and gives the grown-up one obvious button.
- **Which redirect.** From the PIN screen the child was picked from this
  device's own profile list, so the id is already on the device:
  `redirect=/parent/children/<id>?reset=1`. From the username/password screen
  the redirect is `/parent/children` - a typed username is never resolved to a
  child id before a parent signs in (no username enumeration surface).
- **`?reset=1` opens the reset confirm already expanded;** the parent still has
  to press Confirm, so nothing resets from a link alone. If the child is not
  this parent's, the page goes to `/parent/children` instead of "Child not
  found" (the ownership check itself is unchanged, server-side).
- **`redirect` is sanitised in the route's `validateSearch`**
  (`lib/parentRedirect.safeParentRedirect`): the value is resolved against a
  placeholder origin and kept only if it stays on that origin, its path is
  under `/parent/` after normalisation (so `..` can't climb out), it isn't
  `/parent/login` itself, and it has no backslash. Anything else is dropped and
  login falls back to `/parent/dashboard`. So `https://evil`, `//evil`,
  `/\evil` and `/child/...` never become a navigation target.
- **Every parent screen returns you where you were:** `useRequireParent`
  passes the current location as `redirect` when it bounces. It reads the
  location at bounce time rather than subscribing to it, because the effect
  would otherwise re-run on the login URL and overwrite the redirect.
- **Login clears the query cache.** Everything cached was fetched as the
  signed-out identity, including the parent gate's rejected probe, which would
  otherwise bounce the parent straight back to login from the redirect target.
- **Hand-back reuses the existing deep link.** `establishChildSession` already
  signs the parent out, and ADR 0037's picker sends the now PIN-less child to
  username/password login.
- The settings card is renamed "Password & PIN" with a "Reset password & PIN"
  button, because ADR 0037's reset clears both.

## Consequences

- No server change: `children.resetPin` and its ownership check are untouched.
- The `.iwft` harness gains `testing/parentAuthRoute.ts`, a `page.route`
  stand-in for Better Auth sign-in/out that sets a cookie the harness auth seam
  reads from `document.cookie` (the browser drops a `cookie` header on a
  rebuilt `Request`). That lets one test switch from child to parent to child.
- A child on a device where they were never picked (username screen) makes the
  grown-up find them in the list - one extra tap, accepted for no enumeration.
