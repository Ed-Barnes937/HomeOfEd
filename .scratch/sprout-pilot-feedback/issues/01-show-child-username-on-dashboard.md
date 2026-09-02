# 01 — Show the child's username on the parent dashboard

**What to build:** A child's login `username` is generated separately from their
`displayName`, and today the parent dashboard / children list render only
`displayName` (`DashboardPage.tsx`, `ChildrenListPage.tsx`). Unless the parent
noted the username at creation time, "Log in as this child" is a dead end — they
have no way to recover what the account name is. Surface the username wherever
the parent acts on a child.

**Blocked by:** None.

**Status:** done

- [x] The children list page shows each child's `username` alongside
      `displayName` (visually secondary — e.g. a muted "signs in as `<username>`"
      line on the card).
- [x] The child settings page shows the username too.
- [x] The "Log in as …" affordance on the dashboard makes the username visible
      at the point of use, so the parent can relay it to the child.
- [x] No server change expected: `children.list` and `children.get` already
      return `username` — this is UI-only. Verify before adding anything.
- [x] `.iwft` coverage: parent with a child sees the username on the list page.

## Comments

**2026-08-27 (Ed, pilot feedback):** Found during the first real family-pilot
session — could not tell the child what name to type at the child login screen.

**2026-08-27 (agent):** Done and merged to main in PR #114 (`4e973bf`,
branch `sprout-child-username`). UI-only as expected — the username now shows
on the children-list cards, the child settings page, and beside the
dashboard's "Log in as …" link, with `.iwft` coverage on the list page.
