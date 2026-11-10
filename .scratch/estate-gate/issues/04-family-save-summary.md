# 04 - family: a parent can list when each profile last saved

**Status:** ready-for-agent
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
