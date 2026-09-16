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
