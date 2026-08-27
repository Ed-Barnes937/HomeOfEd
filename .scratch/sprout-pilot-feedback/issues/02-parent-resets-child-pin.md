# 02 — Parent can reset a child's PIN

**What to build:** A child's quick-login PIN (`children.pinHash`) can currently
only be changed with knowledge of the existing password or PIN
(`childAuth.changePassword` accepts either as proof). A child who forgets both
is locked out with no parent-side recovery. Give the parent a reset action on
the child settings page.

**Blocked by:** None.

**Status:** ready-for-agent

- [x] New parent-scoped handler (`children.resetPin` or similar): requires the
      parent session, verifies the child belongs to that parent (the existing
      ownership pattern in `handlers/children/`), then clears `pinHash` — do
      not let the parent *choose* the PIN; the child sets a fresh one through
      the existing first-login/PIN-setup flow. Check that flow tolerates a
      null `pinHash` on a device that previously had one registered.
- [x] Decide and implement what happens if the child has also forgotten their
      password: the likely shape is the reset also sets `mustChangePassword`
      and restores the initial-password convention (password = username), but
      confirm against the real `loginPassword` flow before building. If that
      convention is revived, the settings page must say so to the parent.
- [x] Reset is surfaced on the child settings page with a confirm step.
- [x] A `pin_fail` lockout (behavioural-limits `evaluatePinAttempt`) does not
      survive the reset in a way that keeps the child locked out.
- [x] Unit tests on the handler (wrong parent 403s, pinHash cleared); thin
      `.iwft` for the settings-page affordance.

## Comments

**2026-08-27 (Ed, pilot feedback):** No way to recover from a forgotten PIN
today without database surgery.

**2026-08-27 (agent):** Implemented on branch `sprout-parent-clear-pin`; the
decisions are recorded in [ADR 0037](../../../docs/adr/0037-sprout-pin-reset-clears-never-chooses.md).
Two things the ticket's premise had wrong, and how they were resolved:

- There was no child-side PIN-setup flow to fall back on — the PIN was only
  ever parent-set (`children.create`, and a settings-page card driving
  `children.update`'s `pin` input, which already let a parent choose a new PIN
  without any proof). The forced first-login change (`childAuth.changePassword`)
  now optionally takes a `newPin`, so the reset child picks password + PIN in
  one step; login/device-picker results carry `hasPin` so the picker routes a
  PIN-less child to password login (the "tolerates a null pinHash" check —
  previously they'd hit a PIN screen that could only say "Incorrect PIN").
- The likely shape was confirmed and adopted: reset always revives
  password = username + `mustChangePassword`, and the settings-page confirm +
  success copy tells the parent so. The parent-chooses-a-PIN path was removed
  (`children.update` no longer accepts `pin`) since it contradicts this
  ticket and my UI change orphaned it.
