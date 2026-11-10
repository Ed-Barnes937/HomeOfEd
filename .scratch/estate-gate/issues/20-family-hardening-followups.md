# 20 - family: small hardening follow-ups found in review

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md); found by the review of ticket 04 (PR #193)

None is caused by this epic and none blocks it. Each is small.

- **Index `saves(account_id)`.** `saveSummary`, `saveUsage` and
  `deleteAccount` all filter by `account_id` alone, which the primary key
  `(app_id, account_id, slot_key)` cannot serve, so each is a sequential scan
  of every household's saves. Fine at today's size; a migration when it is not.
- **Identity GET replies carry no `Cache-Control: no-store` or
  `X-Content-Type-Options: nosniff`.** Applies to `identity.me`,
  `children.list` and `saveSummary`. ADR 0078 already says no cache rule may
  cover `/api/trpc`; this makes the replies say so themselves.
- **No cap on child profiles per parent.** Bounds `saveSummary`'s output and
  the picker.
- Related and already tracked: a deleted profile's token can still write
  saves (`.scratch/family-first-slice/issues/10-deleted-profile-tokens.md`).

## Comments
