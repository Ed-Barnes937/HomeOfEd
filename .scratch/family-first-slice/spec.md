# Spec: family service first slice - boop saves behind a family account

**Status:** Draft - for Ed's review
**Written:** 2026-09-15, resolving
[account-infra-discovery ticket 08](../account-infra-discovery/issues/08-first-slice-spec-boop.md)
**Decisions honoured:** all 13 from
[ticket 05](../account-infra-discovery/issues/05-decision-sitting.md) (Option C
proper: fresh family service + central SaveStore, browser-direct, hub-owned UI,
boop first slice, copy-never-move import, LWW + merge hook, household gate).
**Spec only.** Building this is a separate epic with its own map, homed in this
directory. Nothing here mutates infra; all `fly`/Cloudflare steps are
human-gated per root `CLAUDE.md`.

## 1. Goal

A kid's boops survive a device change. Concretely: a parent registers (invite
code), adds a child profile, picks "who's playing" on a device; boop then
syncs its whole `boop:save` document to a central SaveStore and restores it on
any other device signed into the same profile. localStorage keeps working
exactly as today, online or offline.

### Non-goals (slice boundary, from ticket 05)

- Nothing for silt/espy/karesansui (silt is the deliberate second slice - it
  stress-tests blobs and quotas).
- No sprout changes. Sprout swaps in later via its ADR 0012 AuthProvider path.
- No ledger/tokens/monetisation - only the extension points (stable account
  ids, parent-child edge, `{ id, role, parentId }` claims).
- No sync engine: save/load whole slot only, LWW per slot, one app-side merge
  hook at import (decision 12).
- No public registration: invite-code-closed household pilot from day one
  (decision 11; the legal-gate ADR is
  [ticket 09](../account-infra-discovery/issues/09-legal-gate-adr.md)).
- No email sending: no verification emails, no self-serve password reset in
  v1. Household-only means Ed resets passwords by hand. Flagged for the gate
  ADR; revisit before any non-household account.

## 2. Name

**Proposal: keep `family` as the final name.** `apps/family`, Fly app
`hoe-family`, subdomain `family.homeofed.com`, package `@hoe/family`. It is
estate plumbing, not a toy - a descriptive name reads right on account
screens and in ADRs, and "family" matches the domain language (parent, child
profile, household) used across tickets 03/05/09. If Ed wants a playful name
anyway, decide it before PR 1; everything below says `family`.

## 3. Architecture overview

```
                    homeofed.com (hub)                boop.homeofed.com
                    /account UI: login,               "synced as X" chip,
                    family mgmt, profile picker       sync + import flow
                          |                                  |
                          |  browser-direct tRPC + Better Auth HTTP
                          |  (CORS allowlist, credentials)
                          v                                  v
                    family.homeofed.com  (apps/family, scale-to-zero)
                    +---------------------------+
                    | identity router           |   Better Auth (parent
                    |   me, children CRUD,      |   email+password, stock
                    |   mint session tokens,    |   tables, invite-code gate)
                    |   delete account          |
                    | save router               |   opaque versioned blobs
                    |   get / put / list /      |   keyed (appId, accountId,
                    |   delete                  |   slotKey); quotas
                    +---------------------------+
                          |
                          v
                    logical DB `family` in hoe-pg
```

- **One app, two routers** (ticket 03 Option C: splitting identity from saves
  later is the normal ADR 0001 §3 escape hatch).
- **Browser-direct (decision 9):** app SPAs call the family service's own
  tRPC. Saves never pass through the owning app's handlers; boop's backend
  stays stateless with no DB (decision 10's answered question).
- **Offline identity verification:** a signed session token in a
  `.homeofed.com` cookie; any app backend can verify it via
  `packages/accounts` with no DB and no round-trip (ADR 0008 preserved).
- **Apps stay leaf nodes:** the shared contract lives in `packages/accounts`
  (the `@hoe/sprout-shared` precedent); no app imports another app.

## 4. The family service (`apps/family`)

Starter-derived (copy base `templates/starter`), single container,
scale-to-zero, DB-backed per the hub pattern. Its SPA is a minimal placeholder
page ("family service - manage your family at homeofed.com/account") so
`createAppServer`, the Dockerfile, and the smoke test stay stock; all real UI
is hub's (decision 5, hard rule 2).

### 4.1 Identity model and schema

Drizzle schema `familySchema`, one committed migration journal, applied by
`migratePostgres` via `release_command` (sprout precedent: Better Auth's own
migrator is not used - its four stock tables are declared in our schema).

- `user`, `session`, `account`, `verification` - stock Better Auth tables,
  **no sprout-style legal-attestation columns** (the family gate is the
  invite code + ticket 09's ADR, not per-row attestations).
- `child_profiles` - `id`, `parentId` FK -> `user.id` `onDelete: cascade`,
  `username` (unique), `displayName`, `createdAt`. **No child email, no child
  credentials** (see 4.3).
- `saves` - `appId`, `accountId`, `slotKey`, `blob` (text), `version`
  (integer, bumped on every put), `sizeBytes`, `createdAt`, `updatedAt`.
  Primary key `(appId, accountId, slotKey)`.

`saves.accountId` holds either a parent `user.id` or a `child_profiles.id`,
so it carries **no FK** (documented in the schema). Erasure is therefore
explicit: `identity.deleteAccount` collects the parent id plus all child
profile ids, deletes their `saves` rows and the `user` row (cascading
profiles) **in one transaction**. A store test pins that no orphan saves
survive - this replaces the FK-cascade erasure guarantee sprout gets for
free.

Blobs are text because every payload is a localStorage value, and
localStorage values are strings by definition. silt's byte blobs arrive at
slice two already string-encoded; no bytea column until a real need shows.

### 4.2 Parent auth: Better Auth, invite-gated

`better-auth` (sprout's version line), Drizzle adapter over the app's single
injected `DbClient<FamilySchema>`, `emailAndPassword` enabled. Registration is
closed behind `REGISTRATION_INVITE_CODE` exactly as sprout does it: a
`hooks.before` check on `/sign-up/email`, secret required in prod with a
boot-crash if missing (`main.ts` posture, sprout ADR-0019 precedent).
`/api/auth/*` is forwarded through Fastify to `auth.handler()` as in sprout.

The Better Auth cookie session is host-scoped to `family.homeofed.com` and is
only ever used by the hub account UI (same-site, cross-origin - see 4.5). It
authorises identity-router procedures: children CRUD, minting session tokens,
account deletion.

### 4.3 Child profiles and "who's playing" (no child credentials)

Decision 11's household posture makes child logins unnecessary in v1: the
parent signs in on a device and picks the active profile ("who's playing?")
on hub's account page. Selecting a profile mints a **family session token**
for that child; the token in the cookie is the device's standing credential
until it expires or the parent switches profiles. There are no child
passwords or PINs (that is sprout's safeguarding model; this estate's toys do
not need it at household scale).

Consequence, stated honestly: anyone holding the device can act as the active
child profile. Acceptable for a supervised household pilot; recorded in
ticket 09's gate ADR as a boundary that must be revisited before any
non-household account.

### 4.4 The family session token

Generalises sprout's `childToken.ts` pattern - self-contained signed claims,
`base64url(JSON).base64url(sig)`, total verification (malformed, tampered,
or expired all return `null`, never throw), 30-day TTL, minted server-side
only.

Claims:

```ts
interface FamilyTokenClaims {
  sub: string                      // user.id or child_profiles.id
  role: 'parent' | 'child'
  parentId?: string                // present when role === 'child'
  name: string                     // displayName, for "synced as X" UI only
  iat: number
  exp: number
}
```

`{ id: sub, role, parentId }` is exactly the decision-record token shape;
`name` is a display convenience, never used for authz.

**One deliberate delta from `childToken.ts`, for Ed to approve: Ed25519
signatures instead of HMAC.** Sprout's HMAC secret is single-app; generalised
across ten apps, a shared HMAC secret would let every consuming app *mint*
tokens, and leaking any one app leaks the minting key. With Ed25519
(`node:crypto` sign/verify, still a few lines), only the family service holds
the private key (`FAMILY_TOKEN_PRIVATE_KEY` Fly secret); the **public** key
ships as plain config in `packages/accounts` - zero secret distribution,
consuming apps need no new Fly secrets at all. Verification stays offline,
DB-less, and total, honouring decision-record intent. Fallback if Ed prefers
the literal pattern: HMAC with a `FAMILY_SESSION_SECRET` set on every
consuming app; everything else in this spec is unchanged.

Cookie: `hoe_family_session`, `Domain=.homeofed.com`, `Secure`,
`SameSite=Lax`, **not** httpOnly - set client-side by hub after the mint call
returns the token (sprout's child-cookie precedent). Client JS reads it for
display ("synced as X") without verifying; tampering can only forge pixels,
never authz, because every server use re-verifies the signature.

### 4.5 CORS and cookie flow

All subdomains of `homeofed.com` are same-site, so cookies flow on
`SameSite=Lax` fetches; CORS is the only barrier. The family service allows
an explicit origin allowlist (`https://homeofed.com` plus
`https://<app>.homeofed.com` for onboarded apps; `http://localhost:<port>`
entries in dev) with `Access-Control-Allow-Credentials: true`. The allowlist
is config, not `*` - it is also the write-side gate on which apps can talk to
the service at all.

### 4.6 The save router (SaveStore)

Opaque, versioned blobs keyed `(appId, accountId, slotKey)`; nothing
app-shaped server-side; `accountId` always derived from the verified family
token in `ctx.auth`, never from input (sprout's authz idiom). **Convention:
`slotKey` is the app's localStorage key, verbatim** - `boop:save` here,
silt's `silt:scene:<id>` keys map naturally at slice two.

Procedures (tRPC, `save` router):

- `save.get({ appId, slotKey })` -> `{ blob, version, updatedAt } | null`
- `save.put({ appId, slotKey, blob })` -> `{ version }` - unconditional
  overwrite (LWW per slot, decision 12), version incremented server-side
- `save.list({ appId })` -> slot metadata (no blobs)
- `save.delete({ appId, slotKey })` -> `{}`

Guards, all enforced in the handler with typed errors:

- `appId` allowlist: `['boop']` in v1 (config). Unknown appId is rejected -
  the SaveStore never becomes a general dumping ground by accident.
- `MAX_SLOT_BYTES = 256 KiB` (boop documents are a few KB; silt renegotiates
  at slice two together with the hoe-pg volume step from ticket 06).
- `MAX_ACCOUNT_BYTES = 2 MiB` total per accountId in v1.
- "Opaque blob" discipline (ticket 03's named risk): the server never parses
  `blob`. Any future "query inside saves" feature is a design smell to refuse
  in review; this line goes in the architecture ADR.

### 4.7 DB and app wiring

The hub pattern, verbatim: `drizzle.config.ts`, `src/server/schema.ts`,
committed `migrations/` + `migrations.ts` (glob for tests) + `migrate.ts`
(release command), `store.ts` with `FamilyStore` interface +
`DrizzleFamilyStore`, `freshTestDb` in tests, PGlite in simulator/iwft,
Postgres in prod. Layered transport -> handlers -> `FamilyStore` (hard rule
3); handlers never touch Better Auth or Drizzle directly.

## 5. `packages/accounts` (`@hoe/accounts`)

Plumbing only (hard rule 2), the one shared surface. Contents:

- **Token:** `familyToken.ts` - `mintFamilyToken` (used only by the family
  service), `verifyFamilyToken` (total, returns claims or null), claim types.
- **AuthProvider:** `familyAuthProvider(publicKey): (req: Request) =>
  AuthProvider` - reads the `hoe_family_session` cookie, verifies, returns
  `FamilyUser = User & { role, parentId?, name }` (extends backend-kit's
  `User = { id }` by intersection, the sprout `providers.ts` idiom). Drops
  into any app's `createContext({ auth })` seam - this is ADR 0008's
  "central identity service issuing tokens apps verify through `ctx.auth`"
  made real.
- **Save client:** typed client for the save router plus the shared
  input/output zod schemas (the `@hoe/sprout-shared` contract precedent; the
  family app's router `satisfies` the shared contract type, so no app ever
  imports `apps/family`).
- **Browser session helper:** `readFamilySession()` - decode-only (no
  verification) claims read for display; null when absent/expired.
- **Fakes (fakes over mocks, hard rule 5):** `FakeFamilyClient` (in-memory
  SaveStore + identity), `mintTestToken` with a committed test-only keypair -
  what hub and boop iwft tests inject.

## 6. Hub: the account UI (decision 5)

Hub owns login and family management at `homeofed.com/account`. Frontend-only
change: one new TanStack route (`/account` added to `router.tsx`'s
`addChildren`) and pages under `apps/hub/src/pages/account/`. Hub's backend,
schema, and fly.toml are untouched - the UI talks browser-direct to the
family service via `@hoe/accounts`.

Flows:

- **Signed out:** sign in; register (email, password, invite code).
- **Signed in (parent):** list/add/rename child profiles; "who's playing on
  this device" picker (mints the family token for the chosen profile - or the
  parent themselves - and sets the `.homeofed.com` cookie); sign out (clears
  cookie + Better Auth session); delete account (confirm step; erasure per
  4.1).

Hub styles its own screens (no shared UI). Ed's monetisation instinct is
preserved by construction: gate screens would be hub's, enforcement is token
claims checked at each app's `ctx.auth` (decision 7's note).

## 7. boop: the first SaveStore client

### 7.1 Wiring

New `apps/boop/src/sync/` module beside the existing `persistence/` module,
which is untouched: localStorage stays the source of truth the app reads, and
every write still lands there first (copy never move, decision 12; the
service being down means boop behaves exactly as today).

- **Push:** piggyback on the existing autosave flush (`autosave.ts` lull
  already debounces): after a local write, if `readFamilySession()` is live,
  `save.put({ appId: 'boop', slotKey: 'boop:save', blob: <the exact
  localStorage value> })`. Fire-and-forget; failures retry on the next save.
- **Pull:** on app start with a live session, `save.get`; if a remote doc
  exists, run the merge hook (7.2) against local, write the result to
  localStorage, and push back if the merge changed the remote.
- **Import (first link):** when a session is present and no
  `boop:syncedAccount` marker exists for this accountId, show "keep these
  boops on your account?" - accept runs the same merge+put and stamps the
  marker; decline stamps the marker without pushing. localStorage is never
  cleared on any path. (`boop:syncedAccount` is a new additive key; the
  frozen `boop:save` key and its ADR 0025 format are untouched.)
- **Affordance:** a small "synced as {name}" chip linking to
  `homeofed.com/account`; nothing else in boop's UI changes.

### 7.2 The boop merge hook (decision 12)

One pure function in `apps/boop` (merge semantics are app logic, not package
plumbing):

```ts
mergeSaveDocuments(local: SaveDocument, remote: SaveDocument): SaveDocument
// creations: remote list, then local creations not structurally present
//            in it (dedupe by deep equality of StoredBoop)
// working:   local if non-null, else remote
```

It runs at import, and also whenever a pull would otherwise drop local-only
creations - the same idempotent union, no versions, no queue, no engine.
Honest limit, accepted per decision 12: `working` is genuinely LWW, and
renames/deletes of the same creation on two devices resolve by union (a
deleted boop can reappear). Fine for a household; revisit only if it bites.

## 8. Testing and simulator story (TDD, hard rule 6)

- **family:** handler unit tests over `freshTestDb(familySchema, migrations)`
  - quota rejections, appId allowlist, LWW versioning, ownership (a parent
  cannot mint for another family's child), transactional erasure. Token
  round-trip/tamper/expiry unit tests in `packages/accounts`.
- **hub:** iwft for the account flows with `FakeFamilyClient` injected via
  `IwftApp` (register-with-invite, add profile, pick profile sets cookie,
  sign out).
- **boop:** unit tests for `mergeSaveDocuments`; iwft for import-offer,
  push-on-save, pull-on-start, and offline degradation (fake client erroring
  = today's behaviour), per the pragmatic test split (state-through-UI in
  iwft, the merge function below it).
- **Live dev:** `pnpm dev --filter=family` runs the service on PGlite at
  port 3010; hub/boop dev servers reach it via localhost CORS entries.
  (Verify loops: `pnpm --filter <app> run <script>` - turbo `--filter` has
  the known cyclic-dep issue.)

## 9. Touchpoint checklist (how-to §1/§2 + this spec's extras)

Per `docs/how-to/adding-an-app.md`, taking the next-free port row:

1. **App:** `apps/family`, package `@hoe/family`.
2. **Ports:** dev **3010**, CT **3110**, compose host **8090**; bump the
   registry's next-free row to 3011/3111/8091 in the same PR (check unmerged
   branches first - the karesansui/hirameki collision precedent).
3. **Fly:** `fly.toml` app `hoe-family`, lhr, shared-cpu-1x/512MB,
   `min_machines_running = 0` (scale-to-zero, decision 7),
   `release_command = 'node src/server/migrate.ts'`.
4. **Subdomain:** `family.homeofed.com` (proxied CNAME -> hoe-family.fly.dev,
   Full-strict TLS, Fly cert).
5. **CI:** copy the `deploy-hub` job as `deploy-family`; add a
   `FAMILY_GO_LIVE` repo-variable gate (the `SPROUT_GO_LIVE` precedent) so
   the code can merge before the Fly app exists.
6. **compose.yml:** the hub two-service pattern - `family` (host 8090) +
   `family-db` (postgres:17, `family-db-data` volume). Note the port-squatter
   quirk on Ed's machine affects 8082/8083 only; 8090 is expected clean.
7. **Secrets (prod):** `BETTER_AUTH_SECRET`, `FAMILY_TOKEN_PRIVATE_KEY`,
   `REGISTRATION_INVITE_CODE`, `DATABASE_URL` via attach. Dev-insecure
   defaults in `.env.example`/simulator, sprout-style.
8. **New package:** `packages/accounts` (config/tsconfig per
   `packages/config`; README required by the verify checklist).
9. **Docs:** `apps/family/CLAUDE.md` (scoped), CONTEXT-MAP.md entry.

**Human-gated steps** (runbook hand-off, never agent-run): `fly apps create
hoe-family`, `fly postgres attach` for the logical `family` DB in hoe-pg,
`fly secrets set` x3, Cloudflare CNAME + cert, setting `FAMILY_GO_LIVE`.

## 10. ADRs to write

- **With the first implementation PR:** `docs/adr/NNNN-family-service.md`
  (next free number) - fresh family service + central SaveStore +
  browser-direct wiring + the token mechanism, citing ticket 05. This is the
  "separate future ADR" ADR 0008 explicitly deferred; it should also record
  the opaque-blob discipline and the slotKey convention.
- **Before merge of anything user-facing:**
  `docs/adr/NNNN-family-service-legal-gate.md` - already ticketed as
  [ticket 09](../account-infra-discovery/issues/09-legal-gate-adr.md); this
  spec depends on its household/invite posture and adds the no-child-
  credentials consequence (4.3) to its inputs.

## 11. Build order and the Lever A checkpoint

Suggested PR sequence for the build epic (each lands green on its own):

1. `packages/accounts` - token, provider, contract, fakes.
2. `apps/family` - schema, Better Auth, both routers, placeholder SPA,
   compose + CI (gated) + port registry + architecture ADR.
3. Hub `/account` UI.
4. boop sync + import + merge hook.
5. Go-live (human-gated infra steps above), household pilot begins.

**Lever A checkpoint (decision 8, deferred):** after this slice ships and
the login/apex cold start can be felt for real, revisit hub
`min_machines_running` 1 -> 0 (~$3.24/mo). Record the verdict as a note on
the build epic; nothing in this slice depends on it either way.

## 12. Proposals in this spec that go beyond ticket 05 (Ed reviews)

Everything above implements recorded decisions except these five, made here
and flagged for the spec review:

1. **Name `family` is final** (§2).
2. **Ed25519 over shared-secret HMAC** for the session token (§4.4) - the
   one delta from sprout's literal pattern; HMAC fallback documented.
3. **No child credentials in v1** - profile picker under a parent session
   (§4.3); consequence recorded for ticket 09's gate ADR.
4. **`slotKey` = localStorage key verbatim**, `appId` allowlist, and the v1
   quota numbers (256 KiB/slot, 2 MiB/account) (§4.6).
5. **No email machinery in v1** - no verification, no self-serve reset (§1).
