# 08 - First-slice spec: boop saves behind a family account

**Status:** ready-for-agent
**Type:** research
**Map:** ../map.md
Blocked by: 05

## Question

Write the implementation spec for the first slice, per the decisions recorded
in [ticket 05](05-decision-sitting.md). Spec only - building it is a separate
epic with its own map. The decided shape the spec must honour:

- **Family service (Option C):** one new scale-to-zero Fly app (working name
  "family"; the spec may propose the final name) with two routers - identity
  (parent email+password accounts via Better Auth stock tables + child
  profiles: username, display name, `parentId`, no child email) and SaveStore
  (opaque versioned blobs keyed `(appId, accountId, slotKey)` with sizes/
  quotas, nothing app-shaped server-side). One logical DB in `hoe-pg`.
- **Tokens carry `{ id, role, parentId }`**, verified offline via the
  generalised sprout `childToken.ts` pattern - consuming apps need no DB and
  no round-trip (ADR 0008 preserved). Ships as the `AuthProvider` in a new
  `packages/accounts`, alongside the save-client contract types.
- **Browser-direct wiring (decision 9):** the SPA talks to the family
  service's own tRPC with a `.homeofed.com` session; saves never pass through
  the owning app's handlers. Answered for Ed in the sitting: app backends
  never load saves into their own DBs - boop stays stateless.
- **Hub owns the account UI (decision 5):** login + family management at
  `homeofed.com/account`; boop keeps only a small "synced as X" affordance.
- **Import is copy, never move (decision 12):** first login offers "keep
  these on your account"; localStorage is never cleared and remains the
  offline/degraded copy. Conflict default LWW-per-slot; boop's import merge
  hook unions `creations`.
- **Household gate (decision 11):** invite-code-closed registration from day
  one; see ticket 09 for the ADR.
- Slice contents: parent account + one child profile, hub login UI,
  `packages/accounts`, the family service, boop's `boop:save` slot with the
  copy-import flow. Nothing for silt/espy/karesansui (silt is the deliberate
  second slice), no sprout changes, no ledger.

The spec should also name: the architecture ADR to be written with the first
implementation PR (fresh family service + central SaveStore + browser-direct,
citing ticket 05), the port-registry row and how-to checklist touchpoints for
the new app, and the **Lever A checkpoint** - after this slice ships, revisit
hub `min_machines_running` 1 -> 0 (decision 8 deferred it until the cold
start can be felt).

## Comments
