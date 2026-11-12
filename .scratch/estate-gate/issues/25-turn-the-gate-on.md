# 25 - Turn the gate on in production, one app at a time

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 2
Blocked by: 17 for every app after boop

The epic PR (#188) ships the gate off in production: no `apps/*/fly.toml`
sets `FAMILY_ACCOUNT_URL`.

1. Done 2026-11-12: the production public key is committed as
   `PRODUCTION_FAMILY_PUBLIC_KEY` in
   `packages/accounts/src/familyVerifyingKey.ts`.
2. boop first: add `FAMILY_ACCOUNT_URL = "https://homeofed.com/account"` to
   `apps/boop/fly.toml` `[env]`, merge, and run the pilot (ticket 17).
3. Then the same one line for armoury, espy, fridge, wotd, boids and
   karesansui, each its own PR or together. silt follows ticket 23.
4. Rollback for any app is removing that line.

## Comments
