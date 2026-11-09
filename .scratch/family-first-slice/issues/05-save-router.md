# 05 - save router: the SaveStore

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §4.6
Blocked by: 01, 03

The SaveStore half of the family service. Opaque, versioned blobs keyed
`(appId, accountId, slotKey)`; `accountId` always derived from the verified
family token in `ctx.auth` (via `@hoe/accounts`' provider), never from input.
The router `satisfies` the shared contract type from `packages/accounts`.

Procedures: `save.get`, `save.put` (unconditional overwrite - LWW per slot,
version incremented server-side), `save.list` (metadata, no blobs),
`save.delete`.

Guards, all in the handler with typed errors:

- `appId` allowlist: `['boop']` in v1 (config) - unknown appId rejected.
- `MAX_SLOT_BYTES = 256 KiB`, `MAX_ACCOUNT_BYTES = 2 MiB` per accountId.
- Opaque-blob discipline: the server never parses `blob` (recorded in the
  ticket 02 architecture ADR; "query inside saves" is a design smell to
  refuse in review).
- Convention: `slotKey` is the app's localStorage key verbatim
  (`boop:save` here; silt's `silt:scene:<id>` maps naturally at slice two).

TDD: quota rejections (slot + account), allowlist rejection, LWW version
bump, ownership (child token reads/writes only its own accountId's rows;
parent token likewise - no cross-account access), get-after-put round-trip,
null on missing.

## Comments

- 2026-11-09: **note, from ticket 03's review.** Add `accountId` string
  identity to the ownership tests.

  `saves.accountId` is a `text` column holding a uuid for child accounts, and
  ticket 03's `deleteAccount` matches on Postgres's canonical lowercase form. A
  row written with any other casing or formatting of the same uuid would never
  match on erasure and would orphan. This is not reachable today, because
  `accountId` always originates from the verified family token's `sub`, which
  is minted from a database read (spec §4.4). It is nonetheless the structural
  price of the no-FK decision, so it belongs in the ownership tests rather than
  resting on a comment.
