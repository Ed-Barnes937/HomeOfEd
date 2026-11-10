# 10 - A deleted profile's token can still write saves

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md); [ADR 0079](../../../docs/adr/0079-family-save-authorisation.md),
[ADR 0081](../../../docs/adr/0081-hub-account-ui.md) amendment 2026-11-10

Family tokens are verified offline and live 30 days, and `requireSaveAccount`
does not check that the account behind a token still exists. So after a parent
deletes a child profile (or erases the household), any other device still
holding that profile's token can `save.put` new rows under the deleted id.
Nothing can reach or erase those rows afterwards: `deleteChildProfile` has
already run, and `deleteAccount` erases only the ids of profiles that still
exist.

Hub clears the cookie on the device the delete was made from. Every other
device is uncovered.

Options to weigh:

- Save handlers check that a child token's profile still exists under its
  `parentId` (and a parent token's user row), refusing with `UNAUTHORIZED` so
  the app drops to local-only. One indexed read per save call.
- A token revocation list or a per-profile token generation claim. Heavier, and
  the save router stays offline-verifiable only in name.

## Comments
