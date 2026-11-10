# 01 - `@hoe/accounts`: estate registry, return URLs, profile-scoped keys, gate builder

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 1, 4, 7, 8

Everything the other tickets import. Pure functions, unit-tested; no UI.

- `ESTATE_APPS`: `{ appId, host, devPort, composePort }` for every gated app
  (boop, armoury, silt, espy, fridge, wotd, karesansui, boids), ports taken
  from the registry in `docs/how-to/adding-an-app.md` and `compose.yml`.
- `accountUrl(accountBase, returnTo)` and `safeReturnTo(raw, { allowLocal })`:
  returns a normalised URL string or `null`. Exact origin match against
  `ESTATE_APPS`; `https` only in production; localhost ports only when
  `allowLocal`. Reject userinfo, other schemes, protocol-relative and
  backslash forms. Test the hostile cases by name.
- `sharedUrl(returnTo, fragment)`: `<origin>/shared<fragment>`.
- `profileScopedKey(key, accountId | null)` and
  `adoptLegacyDocument(storage, key, accountId)`: copies the unscoped value to
  the scoped key once, never writes or removes the unscoped key, and is a no-op
  when the scoped key already exists.
- `@hoe/accounts/server`: `familyDocumentGate({ accountUrl, publicPaths })`
  returning the `documentGate` shape ticket 02 defines (spec decision 1):
  allowed when the request's cookie header holds a token `verifyFamilyToken`
  accepts; otherwise the redirect target with `returnTo` built from the
  request's host and URL.
- ADR 0094 (per-profile local saves, decisions 7-9). Update the package README.

Leave `apps/family/src/server/onboardedApps.ts` alone (decision 14); it is the
SaveStore list, a different list on purpose.

## Comments

**2026-11-10 (implementer).** Built as written, with these differences:

- `familyDocumentGate` also takes `publicKeyPem` (and an optional `now` for
  tests). Verifying needs the public key, and the production public key is not
  in the repo yet: ADR 0070 and first-slice ticket 08 say it ships as config in
  this package, but only the committed test key exists. Each app's `main.ts`
  has to pass it until that is settled (open question for Ed).
- `accountUrl` moves a fragment on `returnTo` onto the account URL itself, so
  a "switch player" link reaches hub in the same shape a gate `302` leaves (the
  browser carries the fragment), and `safeReturnTo` drops any fragment.
- `adoptLegacyDocument` returns whether it copied. "Once" is "while the
  profile's key is absent", as the ticket says; a profile whose key is later
  removed adopts again. A quota error from `setItem` propagates.
- Ticket 10 and others write `accountUrl(<current URL>)` with one argument; the
  contract here is `accountUrl(accountBase, returnTo)` as this ticket says, so
  apps need the account base (`https://homeofed.com/account`) client-side.
