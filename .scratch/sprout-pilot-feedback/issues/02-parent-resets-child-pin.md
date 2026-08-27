# 02 — Parent can reset a child's PIN

**What to build:** A child's quick-login PIN (`children.pinHash`) can currently
only be changed with knowledge of the existing password or PIN
(`childAuth.changePassword` accepts either as proof). A child who forgets both
is locked out with no parent-side recovery. Give the parent a reset action on
the child settings page.

**Blocked by:** None.

**Status:** ready-for-agent

- [ ] New parent-scoped handler (`children.resetPin` or similar): requires the
      parent session, verifies the child belongs to that parent (the existing
      ownership pattern in `handlers/children/`), then clears `pinHash` — do
      not let the parent *choose* the PIN; the child sets a fresh one through
      the existing first-login/PIN-setup flow. Check that flow tolerates a
      null `pinHash` on a device that previously had one registered.
- [ ] Decide and implement what happens if the child has also forgotten their
      password: the likely shape is the reset also sets `mustChangePassword`
      and restores the initial-password convention (password = username), but
      confirm against the real `loginPassword` flow before building. If that
      convention is revived, the settings page must say so to the parent.
- [ ] Reset is surfaced on the child settings page with a confirm step.
- [ ] A `pin_fail` lockout (behavioural-limits `evaluatePinAttempt`) does not
      survive the reset in a way that keeps the child locked out.
- [ ] Unit tests on the handler (wrong parent 403s, pinHash cleared); thin
      `.iwft` for the settings-page affordance.

## Comments

**2026-08-27 (Ed, pilot feedback):** No way to recover from a forgotten PIN
today without database surgery.
