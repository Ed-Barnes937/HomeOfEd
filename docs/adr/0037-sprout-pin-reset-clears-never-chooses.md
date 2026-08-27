# 0037 — sprout: a parent PIN reset clears credentials, never chooses them

- **Status:** Accepted
- **Date:** 2026-08-27
- **Related:** [ADR 0012](0012-sprout-app-owned-auth.md) (the two-identity auth
  seam), pilot-feedback ticket
  (`.scratch/sprout-pilot-feedback/issues/02-parent-resets-child-pin.md`).

## Context

A child who forgot their PIN (and possibly their password) had no coherent
recovery path. The settings page did offer a "Reset PIN" affordance, but it had
the parent *type the new PIN* (`children.update`'s `pin` input) — the parent
then knows the child's login credential, and it did nothing for a forgotten
password or an active `pin_fail` lockout. The pilot ticket asks for a
parent-side reset where the parent does **not** choose the PIN.

There was no child-side PIN-setup flow to lean on: the PIN was only ever set by
the parent (at creation and via update). The forced first-login password change
(`childAuth.changePassword`, proof = temp password or PIN, only usable while
`mustChangePassword` is set) was the closest existing seam.

## Decision

**`children.resetPin` is a full credential reset, and the child re-establishes
both credentials themselves through the first-login flow.**

- The handler (parent session + `verifyChildOwnership`) sets `pinHash = null`,
  `passwordHash = hash(username)` and `mustChangePassword = true`, and deletes
  the child's `pin_fail` behavioural events so a lockout earned on the
  forgotten PIN dies with it.
- `childAuth.changePassword` accepts a `newPin` (4 digits, hashed server-side)
  and **requires** it when the child has no PIN, so the forced-change step
  always leaves a reset child with both credentials — a "PIN-less but
  established" child cannot be created through the API either.
  Login/device-picker results carry `hasPin`, so the picker
  sends a PIN-less child to username/password login instead of a PIN screen
  that can never pass.
- The parent-chooses-a-PIN path is **removed**: the settings-page card is now a
  confirm-gated reset (its copy tells the parent the password is the username
  again), and `children.update` no longer accepts `pin`. Creation still takes a
  parent-chosen initial PIN — at that point the child has no credential to
  prove themselves with.

### Why a full reset rather than PIN-only

A PIN-only clear stranded a child who had also forgotten their password, and a
"PIN-less but established" child is a state nothing else in the flow wants.
Reviving the existing initial-credential convention (password = username,
forced change) means one recovery action, one flow the child already knows, and
no parent-visible secrets. The cost — a child who only forgot their PIN must
also re-pick a password — is acceptable at this product's scale.

## Consequences

- Recovery is self-serve end-to-end: parent confirms the reset, child logs in
  with username/username, picks a new password + PIN.
- The parent never learns a child's live PIN or password after creation.
- `SproutStore` gains `deleteBehaviouralEvents({ kind, childId })`
  (`clearPinFailures` in `behavioural-limits.ts`).
- Until the child completes the forced change, username knowledge alone logs
  into the account (the pre-existing first-login convention, now also true
  post-reset) — the settings page states this so the parent expects it.
