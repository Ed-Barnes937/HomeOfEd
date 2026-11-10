# 04 - family: a parent can list when each profile last saved

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 12

A read for hub's `/account`. No blob is returned and none is parsed.

- New procedure on the identity side (cookie session, `requireParent`, ADR
  0078), not the token-authorised save router (ADR 0079): for the asking
  parent and each of their child profiles, the `appId` and newest `updatedAt`
  of that account's saves.
- Contract and zod schema in `packages/accounts` (`identityContract.ts`,
  `identityClient.ts`), mirrored in `FakeFamilyClient`, with the fake scoped
  to the asking parent like the store.
- Store test against PGlite: two households, proving one never sees the
  other's rows.
- Amend ADR 0079 with one paragraph: this is metadata for the owning parent,
  the opaque-blob rule is intact.

## Comments

- 2026-11-10 (implementer): shipped as the query `identity.saveSummary`,
  client method `saveSummary()`, reply a flat array of
  `{ accountId, appId, updatedAt }` (epoch ms), one per (account, app) with a
  save. Hub groups by `accountId` (the parent's `id` from `me`, a profile `id`
  from `listChildren`). Beyond the ticket: order is fixed by
  `compareSaveSummaryEntries` (code unit, `accountId` then `appId`), exported
  from `@hoe/accounts` and used by both the handler and the fake, so Postgres
  collation cannot make them disagree; `index.ts` exports the new schema, types
  and comparator; a real-socket test in `csrf.test.ts` pins that a family token
  alone gets 401 and an app origin gets no CORS grant; the accounts README
  lists the procedure. Rows under an appId that is no longer onboarded are still
  reported (not filtered by `ONBOARDED_APPS`).
