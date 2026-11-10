# @hoe/accounts

The shared contract for the family service (spec:
[`.scratch/family-first-slice/spec.md`](../../.scratch/family-first-slice/spec.md)
§4.4/§5) - plumbing only, per hard rule 2. Apps and the family service both
import this package; no app ever imports `apps/family`.

## Exports

Four entry points keep node-only code out of browser bundles:

- **`@hoe/accounts`** (browser-safe): claim types, `FAMILY_SESSION_COOKIE`,
  the save-router zod schemas + `FamilySaveContract`, `createFamilySaveClient`
  (the typed browser client), the identity-router schemas +
  `FamilyIdentityContract` + `createFamilyIdentityClient`,
  `FamilyClientError`, `readFamilySession` (decode-only claims read for
  display) and its write half, `writeFamilySession` / `clearFamilySession`.
  The estate gate's browser half: `ESTATE_APPS`, `safeReturnTo`, `accountUrl`,
  `sharedUrl`, `profileScopedKey` and `adoptLegacyDocument` (below).
- **`@hoe/accounts/server`** (node): `mintFamilyToken` / `verifyFamilyToken`
  (Ed25519 via `node:crypto`), `familyAuthProvider` - the AuthProvider any
  app drops into its `createContext({ auth })` seam - and `familyDocumentGate`,
  the value for `createAppServer`'s `documentGate`.
- **`@hoe/accounts/testing`**: `FakeFamilyClient`, the committed TEST-ONLY
  keypair, and `mintTestToken` (node) - so this index is for Node-side callers.
- **`@hoe/accounts/testing/fake`**: `FakeFamilyClient` alone. The index above
  pulls `node:crypto` through the minter, so an in-browser `.iwft` harness
  imports the fake from here instead (boop's does).

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

`writeFamilySession(token, { domain, secure })` is the write half hub uses, and
`clearFamilySession` the sign-out half. The cookie's `Max-Age` comes from the
token's own `exp` rather than a second constant, and a token that cannot be
decoded, or has already expired, writes **nothing**: a cookie the reader would
discard is worse than none, because the UI would report a session that is not
there. `domain` and `secure` are the caller's, because neither can be set on a
local hostname - hub derives them from `window.location.hostname`.

## The estate gate

Spec: [`.scratch/estate-gate/spec.md`](../../.scratch/estate-gate/spec.md);
ADR 0093 (the gate) and [ADR 0094](../../docs/adr/0094-per-profile-local-saves.md)
(per-profile saves).

- **`ESTATE_APPS`** - `{ appId, host, devPort, composePort }` for every gated
  app. It is the only list of origins hub will return a visitor to, so a new
  gated app is added here. Not the family service's `onboardedApps.ts`, which is
  the SaveStore list and differs on purpose.
- **`safeReturnTo(raw, { allowLocal })`** - the open-redirect guard. Returns the
  normalised URL without its fragment, or `null`. The origin must exactly match
  `https://<host>`, or with `allowLocal` (hub on localhost only)
  `http://localhost:<devPort|composePort>`. Anything the URL parser would
  quietly repair is refused, not repaired: whitespace or control characters,
  backslashes, userinfo, odd slash counts, upper case, explicit ports. Each
  hostile form has a named test in `returnTo.test.ts`; add one there before
  relaxing anything.
- **`accountUrl(accountBase, returnTo)`** - `<accountBase>?returnTo=<url>`. A
  fragment on `returnTo` moves onto the account URL, which is where the browser
  leaves it after the gate's `302`, so hub reads both entries the same way.
- **`sharedUrl(returnTo, fragment)`** - `<origin>/shared<fragment>`, for hub's
  "Open what was shared". Pass it a `safeReturnTo` result, never a raw value.
- **`profileScopedKey(key, accountId)`** - `key` for no account, else
  `key@<accountId>`. The SaveStore `slotKey` stays the unscoped key.
- **`adoptLegacyDocument(storage, key, accountId)`** - copies the unscoped
  value to the profile's key unless that key already exists; never writes or
  removes the unscoped key. Returns whether it copied. `storage` is anything
  with `getItem`/`setItem`, such as `localStorage`.
- **`familyDocumentGate({ accountUrl, publicPaths, publicKeyPem, now? })`**
  (server) - `redirectFor` returns `null` for a cookie holding a token
  `verifyFamilyToken` accepts (either role), else the account URL with
  `returnTo` built from the request's `Host` and URL (`http` for localhost,
  `https` otherwise). A host or target that would build a URL on another host
  gets the bare account URL. `publicPaths` is passed through for
  `createAppServer` to skip.

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

## The identity contract

The identity router's half of the same deal, for hub's `/account` screens
alone. `createFamilyIdentityClient({ baseUrl })` covers `identity.me`,
`children.list/add/rename/delete`, `mintSessionToken` and `deleteAccount` over tRPC,
plus Better Auth's own `/api/auth/sign-up/email`, `/sign-in/email` and
`/sign-out`. The split matters: the tRPC half has zod schemas here because
their shapes are ours, while the Better Auth half is typed as plain interfaces
because those shapes are Better Auth's.

Three properties are load-bearing, all from
[ADR 0078](../../docs/adr/0078-family-identity-auth-boundary.md):

- **Every call is authorised by the Better Auth cookie session, never by the
  family token.** Nothing in `identityClient.ts` reads or sends a token, and
  widening that would let any script on any estate subdomain erase a household.
- **`deleteAccount` sends `{ confirm: true }`.** The procedure has an input
  parser precisely so that tRPC reads the body; erasure fails without it.
- **Every mutation carries `content-type: application/json`**, which is what
  forces the preflight the CORS allowlist then governs (decision 5).

A taken child username arrives as a typed `CONFLICT` carrying "that username is
already taken", from `addChild` and from a `renameChild` that changes the
username, and hub shows it inline on whichever form sent it.

The contract is split in two because only half of it is a tRPC router.
`FamilyIdentityRouterContract` is the seven procedures, and the family app's
identity router `satisfies` it exactly as the save router satisfies
`FamilySaveContract`, taking its input schemas from here too - so a divergence
is a compile error in `apps/family` rather than a 400 somebody meets in a
browser. `FamilyAuthContract` is the other three: they are not procedures, so no
router could ever implement them.

## Testing

`pnpm --filter @hoe/accounts run test` - vitest unit tests: token round-trip /
tamper / expiry / malformed / wrong-shape, provider mapping, decode-only
session read, wire-format + error mapping of the client, the return-URL
allowlist against named hostile inputs, legacy adoption, the gate's redirects,
and the fake's
contract behaviour (LWW versioning, per-account scoping, UNAUTHORIZED when
signed out, `failWith` offline degradation).

Consumers inject `FakeFamilyClient` wherever prod wires
`createFamilySaveClient` or `createFamilyIdentityClient` (fakes over mocks,
hard rule 5). It implements **both** contracts, and keeps their credentials as
separate as the service does: `signInAs` / `clearTokenSession` drive the family
token, which authorises saves alone, and `signUp` / `signIn` / `signOut` drive
the parent cookie session, which authorises identity alone. Tests pin that
neither stands in for the other, so a harness that confuses them fails here
rather than in production. `failWith` makes both halves reject, as an outage
would. The tokens it mints are decodable by `readFamilySession` (same
`base64url(JSON).signature` shape, placeholder signature) so a cookie written
in a browser harness reads back.

**The fake runs the same validators the service runs.** Every input goes through
the contract's own zod schema - the same object `router.ts` passes to
`.input()`, so a tightened bound cannot diverge - and a parser failure arrives as
`BAD_REQUEST` carrying the ZodError's own message, which is what tRPC really
sends. The save quotas come from `saveLimits.ts`, the one definition
`apps/family`'s handlers re-export. That is not decoration: before it, a
33-character name, an untrimmed `' Ada '`, a 300 KB blob and a 65th slot all
passed here and failed in production, and the untrimmed name stored a different
string on each side. The habit behind that, and the four findings before it, is
recorded in
[`packages/backend-kit`'s README](../backend-kit/README.md#a-stand-in-models-the-happy-path-somebody-has-to-make-it-model-the-rest).

Two things the fake still declines to model, both app configuration rather than
contract: the **`appId` allowlist** (`onboardedApps.ts`, proven by the handler
tests in `apps/family`), and anything behind a Better Auth option. It also
assigns child ids in sequence, so `listChildren` sorts by `(createdAt, id)` -
the same two keys `listChildProfiles` now orders by, so two profiles created in
one millisecond come back in the same order on both sides.
