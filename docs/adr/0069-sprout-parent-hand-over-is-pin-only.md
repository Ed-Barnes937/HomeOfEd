# 0069 - sprout: a parent hand-over signs the child in with just their PIN

- **Status:** Accepted
- **Date:** 2026-09-27
- **Related:** [ADR 0012](0012-sprout-app-owned-auth.md) (the two identities
  behind one `ctx.auth` seam),
  [ADR 0068](0068-sprout-child-forgot-hands-off-to-a-grown-up.md) (the other
  grown-up hand-over: a forgotten login routes to a parent reset).

## Context

The parent dashboard's "Log in as <child>" link opens `/child/login?child=<id>`.
Until now that jumped to the PIN screen only when the device already knew the
child from an earlier password login; on a new device the child had to type
their username and password even though their parent was signed in and had
just picked them.

## Decision

A signed-in parent's session stands in for the child's password.

- `childAuth.parentChildProfile` (parent-scoped, ownership-checked) tells the
  login page the deep-linked child belongs to the signed-in parent, and whether
  they have a PIN.
- `childAuth.loginPinFromParent` verifies ownership against `ctx.auth`, then the
  PIN, with the same lockout and `pin_fail` recording as `childAuth.loginPin`
  (shared `verifyChildPin`). It registers the device, like a password login, so
  the picker offers the child here next time.
- The child still proves themselves with their PIN; the parent session only
  replaces the password. After login the parent is signed out as before (one
  identity per browser).
- Without a parent session, a fresh sign-in still needs username and password.
  A child with no PIN (after a parent reset) still goes to password login and
  the forced-change flow, since there is no PIN to check.

## Consequences

- The PIN alone now unlocks a child on any device the parent is signed in on.
  The parent session is the stronger credential, so this adds no new way in for
  someone without it.
- The PIN lockout is per child across both PIN logins, so a guesser gains
  nothing by switching path.
