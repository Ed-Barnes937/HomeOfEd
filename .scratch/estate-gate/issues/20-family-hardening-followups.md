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
  - [x] `Cache-Control`: done by ticket 22. Every `/api/trpc` reply is now
    `private, no-store`, set by the session bridge (ADR 0070, 2026-11-12
    amendment).
  - [ ] `X-Content-Type-Options: nosniff`: still open.
- **No cap on child profiles per parent.** Bounds `saveSummary`'s output and
  the picker.
- **Sign-in rate limit may be one bucket for everyone in production (not
  verified).** Better Auth allows 3 tries per route per 10 seconds per client
  IP. `apps/family` configures no IP header, and in the docker stack it logs
  "could not determine a client IP" and falls back to one shared bucket per
  route. If the same happens on Fly behind Cloudflare, three tries by anyone
  lock every household out for 10 seconds. Check production's logs for that
  warning; if present, configure the header Fly/Cloudflare supplies
  (`Fly-Client-IP` or `CF-Connecting-IP`). Found by ticket 09.
- **Hub cannot read the real retry period.** The 429 carries
  `x-retry-after: 10` but family exposes no headers across origins, so hub
  pauses the form for a fixed 60 seconds (ticket 09).
- **A parent cannot sign out another device.** Since ticket 22 a parent
  session lasts 90 days after last use, so a lost tablet stays signed in as
  the parent (mint for any child, edit profiles, erase the household) until
  then. Hub offers sign-out on this device only: no "sign out everywhere", no
  session list, no change-password. Better Auth already ships
  `/api/auth/list-sessions`, `/revoke-sessions` and `/revoke-other-sessions`
  behind family's relay; hub would need a button and the identity client a
  call. Today the only remote ends are erasing the household or deleting the
  parent's `session` rows by hand (ADR 0070, 2026-11-12 amendment).
- Related and already tracked: a deleted profile's token can still write
  saves (`.scratch/family-first-slice/issues/10-deleted-profile-tokens.md`).

## Comments
