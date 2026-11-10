# 25 - Turn the gate on in production, one app at a time

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 2
Blocked by: Ed committing the production verifying key (ticket 19), and 17
for every app after boop

The epic PR (#188) ships the gate off in production: no `apps/*/fly.toml`
sets `FAMILY_ACCOUNT_URL`, and a test in `@hoe/accounts` fails if one does
while `PRODUCTION_FAMILY_PUBLIC_KEY` is null.

1. Print the public key from family's signing key and commit it as
   `PRODUCTION_FAMILY_PUBLIC_KEY` in
   `packages/accounts/src/familyVerifyingKey.ts`:
   `openssl pkey -in <private-key.pem> -pubout`. It is a public key; it is
   safe in the repo.
2. boop first: add `FAMILY_ACCOUNT_URL = "https://homeofed.com/account"` to
   `apps/boop/fly.toml` `[env]`, merge, and run the pilot (ticket 17).
3. Then the same one line for armoury, espy, fridge, wotd, boids and
   karesansui, each its own PR or together. silt follows ticket 23.
4. Rollback for any app is removing that line.

## Comments
