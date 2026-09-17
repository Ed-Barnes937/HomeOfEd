# 06 - hub `/account`: login, family management, who's playing

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §6
Blocked by: 01, 04

Hub owns the account UI (decision 5). Frontend-only change: one new TanStack
route (`/account` in `router.tsx`'s `addChildren`) and pages under
`apps/hub/src/pages/account/`. Hub's backend, schema, and fly.toml untouched;
the UI talks browser-direct to the family service via `@hoe/accounts`.

Flows:

- **Signed out:** sign in; register (email, password, invite code).
- **Signed in (parent):** list/add/rename child profiles; "who's playing on
  this device" picker - mints the family token for the chosen profile (or
  the parent) and sets the `hoe_family_session` cookie
  (`Domain=.homeofed.com`, `Secure`, `SameSite=Lax`, not httpOnly - set
  client-side from the mint response, sprout's child-cookie precedent);
  sign out (clears cookie + Better Auth session); delete account (confirm
  step; erasure per spec §4.1).

Hub styles its own screens (hard rule 2 - no shared UI). Match hub's design
system (`apps/hub/.design-sync/NOTES.md`).

TDD: iwft with `FakeFamilyClient` injected via `IwftApp` -
register-with-invite, add profile, pick profile sets cookie, sign out.

**Merge gate:** ADR 0057 (family-service legal gate) must be **accepted**
before anything user-facing merges (spec §10) - it is Proposed as of
2026-09-15; chase Ed if still open when this ticket starts.

## Comments
