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
  `FamilyClientError` and `SaveAccountMismatchError`, `readFamilySession`
  (decode-only claims read for display) and its write half,
  `writeFamilySession` / `clearFamilySession`.
  The estate gate's browser half: `ESTATE_APPS`, `safeReturnTo`, `accountUrl`,
  `sharedUrl`, `profileScopedKey` and `adoptLegacyDocument` (below), and what an
  app calls to sit behind it: `profileStorage`, `memoryStorage`,
  `arrivalFragment`, `bindSaveClient`, `reloadOnPlayerChange`, `hubUrlFor` and
  `switchPlayerUrlFor` (see "In a gated app's browser code").
- **`@hoe/accounts/server`** (node): `mintFamilyToken` / `verifyFamilyToken`
  (Ed25519 via `node:crypto`), `familyAuthProvider` - the AuthProvider any
  app drops into its `createContext({ auth })` seam - `familyDocumentGate`,
  the value for `createAppServer`'s `documentGate`, and
  `familyDocumentGateFromEnv`, the one gate call an app's `main.ts` makes.
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
  app (and `HUB_LOCAL_PORTS`, hub's own two localhost ports). It is the only
  list of origins hub will return a visitor to, so a new gated app is added
  here. Not the family service's `onboardedApps.ts`, which is
  the SaveStore list and differs on purpose. `estateApps.test.ts` fails if a
  `composePort` drifts from the port `compose.yml` publishes.
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
- **`accountUrlFor(currentHref)`** - the one-argument form apps use for a
  "switch player" link. The base comes from where the app runs, as hub derives
  its cookie `Domain` from the hostname (ADR 0081 decision 3): production hub
  for an `ESTATE_APPS` host, `localhost:<HUB_LOCAL_PORTS.devPort>` for an app on
  its `devPort`, `localhost:<HUB_LOCAL_PORTS.composePort>` for its
  `composePort`. `null` anywhere else (espy's Capacitor shell): show no link.
  Its `returnTo` is always one `safeReturnTo` accepts; an href that would not
  be (upper case, an explicit port, `blob:`) gives `null` too.
- **`sharedUrl(returnTo, fragment, { allowLocal })`** -
  `<origin>/shared<fragment>`, for hub's "Open what was shared", or `null`. It
  vets `returnTo` through `safeReturnTo` itself, so a caller that forgets
  cannot produce an off-estate link.
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
  `createAppServer` to skip. Bad config throws at construction, so it fails
  the boot rather than every request: `accountUrl` must be an absolute http(s)
  URL, and `publicKeyPem` must be exactly one PEM public key block, nothing
  around it, holding an Ed25519 key (PEM text holding a private key is refused
  by name). The key is parsed once and handed to `verifyFamilyToken`, which
  takes PEM text or a `KeyObject`.

### The verifying key

ADR 0070 (amended). Which key the gate verifies with depends on where it runs:

- **On Fly** (`FLY_APP_NAME` set): the committed constant
  `PRODUCTION_FAMILY_PUBLIC_KEY` in `src/familyVerifyingKey.ts`, and nothing
  else. `FAMILY_TOKEN_PUBLIC_KEY` is a local-only setting there: its presence
  refuses the boot, through `@hoe/deploy-guard`'s `localOnly` (which also
  requires `NODE_ENV=production`). A constant still `null` refuses the boot too.
  Rotating the key is a code change and a redeploy, never a Fly variable.
- **Off Fly**: `FAMILY_TOKEN_PUBLIC_KEY` when set (escaped `\n` unescaped, the
  one-line form `compose.yml` uses), else the constant. With neither, it
  refuses to boot. `compose.yml` sets the test public key on every
  `ESTATE_APPS` service, matching the key its family signs with, and
  `estateApps.test.ts` checks that.

### In a gated app's browser code

These calls cover what every gated app does in the browser. boop is the
reference (`apps/boop/src/App.tsx`, `pages/views.tsx`, `pages/HomePage.tsx`,
`features/topbar/`).

- **`profileStorage(device, accountId, { keys, prefixes })`** - a
  `StorageLike` (`getItem`, `setItem`, `removeItem`, `key`, `length`, `clear`)
  over `device` (`window.localStorage`).
  - **Which keys are scoped.** Exact `keys` and any key starting with one of
    `prefixes` (silt's `silt:scene:`) are stored under
    `profileScopedKey(key, accountId)`. Every other key passes straight through.
  - **What it lists.** `key(i)`, `length` and `clear()` cover this profile's
    keys only, by their unscoped names. Signed out (`accountId` null), this
    profile's keys are the legacy documents, so `clear()` removes them.
  - **Keys it refuses.** A profile key that already carries an `@` (a
    prefixed key whose remainder has one, or `boop:save@<someone>`) throws, so
    one profile can never name another's document.
  - **Adopting legacy documents.** On open it copies the device's legacy
    documents in, never moving them. For an exact key, that means
    `adoptLegacyDocument`. For a prefix, it means every unscoped key under the
    prefix, all or nothing, and only while the profile has no key under it yet.
  - **A full quota.** If the quota fills during adoption, the error is
    swallowed and nothing is left half-written, so the next open simply tries
    again. If the profile saves its own document before an adoption succeeds,
    it never adopts that key; the legacy copy stays on the device.
  - **Usage.**
    - Build it once per page from the account the page opened for, and pass it
      wherever the app used `window.localStorage` for a save. The app's code
      keeps naming its unscoped keys.
    - List saves only, never device preferences.
    - A prefixed key's remainder must not contain `@` (see above).
    - Never build it on `/shared`: building it copies the legacy documents in,
      and that is a write.
  - **What it does not cover.** IndexedDB, and any other store keyed by
    something other than these names. Scope those with `profileScopedKey`
    directly.
- **`memoryStorage()`** - the same interface held in memory, for `/shared`,
  which must write nothing (ADR 0093 decision 6).
- **`arrivalFragment()`** - the fragment the page was opened with, byte for
  byte. It is captured when this package first loads, before a TanStack Router
  mounts and decodes the address bar (`#w=%7B%7D` becoming `#w={}`).
  - After a hash-only navigation to a different fragment, it returns the new
    one.
  - It returns `''` once the address bar has no fragment or is on another path,
    so a remount after the app clears its fragment does not replay it.
  - Import the package from the app's entry chunk; a lazily loaded chunk would
    capture after the router.
- **`createFamilySaveClient({ baseUrl, accountId })`** - the save client,
  bound to the profile the page opened for (ADR 0080, amended).
  - Every call sends `expectedAccountId`, and the service refuses a call made
    with another profile's token.
  - A call made while `readFamilySession()` names anyone else is refused before
    it is sent.
  - Either refusal arrives as a `SaveAccountMismatchError`; sync should stop
    for good on it. Only the service's `CONFLICT` carrying the
    `SAVE_ACCOUNT_MISMATCH` message counts; any other `CONFLICT` stays a plain
    `FamilyClientError`. `bindSaveClient(client, accountId)` adds the same binding
    to any client, such as `FakeFamilyClient`.
  - Build it only when there is a session.
- **`reloadOnPlayerChange(openedFor)`** - call it where the profile's storage
  is built, not on `/shared`, with the account the page opened for (`null`
  when signed out). A reload on `/shared` would throw away a visitor's unsaved
  edits, and nothing there belongs to a profile. When the page comes
  back into view (`pageshow`, including a bfcache restore, a visible
  `visibilitychange`, or `focus`) with a different profile signed in, or none,
  it reloads the page. A tab therefore never shows or saves one profile's work
  under another. It returns a function that stops watching.
- **`hubUrlFor(href)`** - hub's origin on the same tier as the app (production,
  dev port or compose port), for a back-to-hub link; production hub anywhere
  else. **`switchPlayerUrlFor(href)`** - `accountUrlFor` on `href` without its
  fragment, so a "switch player" link returns here once a player is picked;
  `null` outside the estate.

### Wiring the gate in an app

**`familyDocumentGateFromEnv(env, { publicPaths, now? })`** is the only gate
call an app's `main.ts` makes. It returns `undefined` (gate off) when
`FAMILY_ACCOUNT_URL` is unset or empty, without resolving any key, so an app
with the gate off boots as it always has. With it set, it returns
`familyDocumentGate` built from that URL and the key above, and so throws at
boot for any of the refusals above.

```ts
import { familyDocumentGateFromEnv } from '@hoe/accounts/server'

const server = createAppServer({
  // ...
  documentGate: familyDocumentGateFromEnv(process.env, { publicPaths: ['/shared'] }),
})
```

**The app's Dockerfile.** `@hoe/accounts/server` runs from TS source and
imports `@hoe/deploy-guard`. A gated app therefore needs all of the following:

1. `"@hoe/accounts": "workspace:*"` under `dependencies` (not
   `devDependencies`) in the app's `package.json`, so `turbo prune` keeps it.
2. In the `prod-deps` stage, add `--filter=@hoe/accounts --filter=@hoe/deploy-guard`
   to the `pnpm install --frozen-lockfile --prod` line.
3. In the `runner` stage, beside the other package `COPY` lines:

   ```dockerfile
   COPY --from=pruner /app/out/full/packages/accounts ./packages/accounts
   COPY --from=pruner /app/out/full/packages/deploy-guard ./packages/deploy-guard
   ```

4. Add `packages/accounts/src/testing` to the final `rm -rf`. Nothing outside
   it imports it (a test in `familyVerifyingKey.test.ts` pins that), so the
   image need not carry the committed test private key. Family is the
   exception: its own env guard imports that key, so its image keeps it.

### The production key

`PRODUCTION_FAMILY_PUBLIC_KEY` in `src/familyVerifyingKey.ts` is the public
half of family's signing key (committed 2026-11-12). It is public: it can
check a token, never make one. Without it a gated app refuses to boot on Fly.

To rotate, print the public half of the new signing key

```sh
openssl pkey -in <private-key.pem> -pubout
```

and replace the constant with the three output lines joined by `\n`, as one
string. The tests check it is an Ed25519 public key the gate accepts and not
the test key. Every gated app then needs a redeploy.

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
`children.list/add/rename/delete`, `mintSessionToken`, `deleteAccount` and
`saveSummary` over tRPC, plus Better Auth's own `/api/auth/sign-up/email`,
`/sign-in/email` and `/sign-out`.

The split matters: the tRPC half has zod schemas here because their shapes are
ours, while the Better Auth half is typed as plain interfaces because those
shapes are Better Auth's.

`saveSummary` is how hub shows when each profile last saved: one entry per
(account, app) with a save, `{ accountId, appId, updatedAt }`, for the signed-in
parent and their own profiles only, in `compareSaveSummaryEntries` order (code
unit, so the service and the fake agree). It never carries a blob
([ADR 0079](../../docs/adr/0079-family-save-authorisation.md), amended).

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
`FamilyIdentityRouterContract` is the eight procedures, and the family app's
identity router `satisfies` it exactly as the save router satisfies
`FamilySaveContract`, taking its input schemas from here too - so a divergence
is a compile error in `apps/family` rather than a 400 somebody meets in a
browser. `FamilyAuthContract` is the other three: they are not procedures, so no
router could ever implement them.

## Testing

`pnpm --filter @hoe/accounts run test` - vitest unit tests: token round-trip /
tamper / expiry / malformed / wrong-shape, provider mapping, decode-only
session read, wire-format + error mapping of the client, the return-URL
allowlist against named hostile inputs, legacy adoption, profile-scoped and
memory storage, the arrival fragment, hub and switch-player links, the gate's redirects,
the verifying key on and off Fly (directly and through
`familyDocumentGateFromEnv`), the `compose.yml` ports and keys against
`ESTATE_APPS`, and the fake's
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

It also enforces Better Auth's built-in limit on `signIn` and `signUp`: three
tries per route in ten seconds, then `TOO_MANY_REQUESTS` with the real 429's
message, as checked against the docker stack
([ADR 0081](../../docs/adr/0081-hub-account-ui.md), rate-limit amendment).

Two things the fake still declines to model, both app configuration rather than
contract: the **`appId` allowlist** (`onboardedApps.ts`, proven by the handler
tests in `apps/family`), and anything behind a Better Auth option. It also
assigns child ids in sequence, so `listChildren` sorts by `(createdAt, id)` -
the same two keys `listChildProfiles` now orders by, so two profiles created in
one millisecond come back in the same order on both sides.
