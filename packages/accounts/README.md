# @hoe/accounts

The shared contract for the family service (spec:
[`.scratch/family-first-slice/spec.md`](../../.scratch/family-first-slice/spec.md)
§4.4/§5) - plumbing only, per hard rule 2. Apps and the family service both
import this package; no app ever imports `apps/family`.

## Exports

Three entry points keep node-only code out of browser bundles:

- **`@hoe/accounts`** (browser-safe): claim types, `FAMILY_SESSION_COOKIE`,
  the save-router zod schemas + `FamilySaveContract`, `createFamilySaveClient`
  (the typed browser client), `FamilyClientError`, and `readFamilySession`
  (decode-only claims read for display).
- **`@hoe/accounts/server`** (node): `mintFamilyToken` / `verifyFamilyToken`
  (Ed25519 via `node:crypto`) and `familyAuthProvider` - the AuthProvider any
  app drops into its `createContext({ auth })` seam.
- **`@hoe/accounts/testing`**: `FakeFamilyClient` (browser-safe - iwft runs in
  the browser), the committed TEST-ONLY keypair, and `mintTestToken` (node).

## The family session token

`base64url(JSON claims).base64url(sig)`, Ed25519-signed, 30-day TTL - sprout's
`childToken.ts` generalised. Only the family service holds the private key
(`FAMILY_TOKEN_PRIVATE_KEY` Fly secret); the public key ships as plain config,
so consuming apps verify offline with no DB, no round-trip, and no new
secrets - and no app can mint. Verification is **total**: malformed, tampered,
wrong-key, wrong-shape, or expired all return `null`, never throw.

Claims: `{ sub, role: 'parent' | 'child', parentId?, name, iat, exp }` -
`parentId` present exactly when `role === 'child'`; `name` is display-only
("synced as X"), never authz.

The token travels in the `hoe_family_session` cookie (`Domain=.homeofed.com`,
not httpOnly - set client-side by hub after the mint call). `readFamilySession`
reads it decode-only for display; tampering can only forge pixels, because
every server use re-verifies through `verifyFamilyToken`.

## The save contract

Opaque, versioned blobs keyed `(appId, accountId, slotKey)`; `accountId` is
never an input - the service derives it from the verified token in `ctx.auth`.
`slotKey` is the app's localStorage key, verbatim. Timestamps travel as epoch
ms (JSON-safe, no transformer).

`createFamilySaveClient({ baseUrl })` speaks tRPC's stable HTTP conventions
(GET query / POST mutation, single calls, no transformer) with hand-rolled
fetch, because the family app's `AppRouter` type may not be imported by apps
(hard rule 1) - the zod contract is the type authority, and every response is
parsed against it. All calls carry `credentials: 'include'`; the family
service's CORS allowlist is the gate.

The family app's save handler is expected to `satisfies FamilySaveContract`
(checked in `apps/family`, ticket 02), so the contract, the real client, and
the fake can never drift apart silently.

## Testing

`pnpm --filter @hoe/accounts run test` - vitest unit tests: token round-trip /
tamper / expiry / malformed / wrong-shape, provider mapping, decode-only
session read, wire-format + error mapping of the client, and the fake's
contract behaviour (LWW versioning, per-account scoping, UNAUTHORIZED when
signed out, `failWith` offline degradation).

Consumers inject `FakeFamilyClient` wherever prod wires
`createFamilySaveClient` (fakes over mocks, hard rule 5); `signInAs` /
`signOut` / `failWith` drive the identity and failure modes.

Two deliberate limits of the fake: it does not enforce the spec §4.6 server
guards (appId allowlist, slot/account quotas) - those are family-handler
config, proven by the handler tests in `apps/family` - and its identity
surface is session switching only; the identity-router flows (register,
children CRUD, mint) grow here when the hub account UI needs them
(ticket 06).
