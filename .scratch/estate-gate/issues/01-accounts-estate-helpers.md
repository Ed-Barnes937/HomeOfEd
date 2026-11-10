# 01 - `@hoe/accounts`: estate registry, return URLs, profile-scoped keys, gate builder

**Status:** ready-for-agent
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
