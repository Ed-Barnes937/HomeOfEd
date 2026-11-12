# 0079 - the family SaveStore: two credentials on one seam, and a second door

- **Status:** Accepted
- **Date:** 2026-11-09 (amended 2026-11-10: `identity.saveSummary`, and
  `expectedAccountId`; see the end)
- **Related:** [ADR 0078](0078-family-identity-auth-boundary.md) (the identity
  half, whose boundary this one mirrors, and whose **decision 5** - the
  content-type requirement on `/api/trpc` - was added from this ticket's review), [ADR 0070](0070-family-service.md)
  (the family service and its opaque-blob discipline),
  [ADR 0008](0008-apps-without-a-database.md) (tokens apps verify through
  `ctx.auth`). Implements first-slice ticket 05; the design is
  [the first-slice spec](../../.scratch/family-first-slice/spec.md) §4.5-§4.6.

## Context

[ADR 0078](0078-family-identity-auth-boundary.md) built the identity half and
left the save half two unfinished edges: a seam that resolves one credential but
must serve two, and a CORS allowlist narrowed to hub with the note that onboarded
app origins "arrive with the save router, not before".

Building the save router showed that the first of those is not a matter of
precedence. Both credentials arrive on the same request in the ordinary case: the
Better Auth cookie is host-scoped to `family.homeofed.com` and travels on any
same-site credentialled fetch, and the family token cookie is scoped to
`.homeofed.com`. A parent signed in on hub who has picked which child is playing
therefore sends both on every save from boop - and they name **different
people**, the parent's `user.id` and a `child_profiles.id`. Preferring either one
breaks the other router: token-first locks a parent out of managing profiles,
session-first stops the one flow the SaveStore exists for.

## Decision

**1. The two credentials occupy separate fields of one user, and neither can
stand in for the other.** `familySeam` resolves both independently. A resolved
cookie session keeps `id` and `kind: 'parent-session'`, exactly as
[ADR 0078](0078-family-identity-auth-boundary.md) decided; a verified token
becomes a nested `saveAccount: { accountId, role, parentId? }`. `requireParent`
reads `kind` and `id`; `requireSaveAccount` reads `saveAccount` and never `id`.
Since `id` is the cookie session's whenever there is one, a save handler that
reached for `user.id` would act for the parent while holding a child's token,
which is why no save handler may read it and why a test puts a parent session and
a child token on one request and checks each guard sees only its own.

The guard is **positive**: it requires a `saveAccount` carrying one of the two
roles, which only a verified token produces. A guard that merely asked whether
some user existed would admit a parent's cookie session, the mirror of the attack
ADR 0078 refuses in the other direction. Neither direction is enforced by the
type system, so both have a test.

**2. CORS is tiered by what the route authorises, and a mixed tRPC batch is not a
save request.** Identity and `/api/auth/*` keep the hub account UI alone. The
save tier adds onboarded app origins, because it is authorised by the token
rather than the cookie and apps call it browser-direct. It is a superset of the
identity tier, never the reverse.

What the tier split protects is the **cookie** surface, not the token surface.
The family token is deliberately readable by client JS on every estate origin
([ADR 0070](0070-family-service.md)), so an XSS anywhere exfiltrates it and a
non-browser client then presents it from anywhere at all; CORS cannot touch
that, and the real controls on a stolen token are its signature and its 30-day
TTL, as [ADR 0057](0057-family-service-legal-gate.md) item 5 already accepts.
The tier exists so that the save router's wider list cannot become a door to the
cookie-authorised one, and that is the whole of its job.

tRPC puts several procedure names in one path, so the tier is chosen only after
checking that **every** name in the request matches `save.<identifier>`:
otherwise an app origin could batch `identity.deleteAccount` behind `save.get`,
be granted the save tier, and read the reply - precisely the XSS-erases-a-
household path ADR 0078 narrowed the identity list to prevent. The pattern admits
no percent-encoding, which is not a theoretical precaution: tRPC's Fastify
adapter was observed in the production image dispatching
`/api/trpc/save.get%2Cidentity.me?batch=1` as a real two-procedure batch, so a
check that split on the literal comma alone would have read that as a save
request. Anything unrecognised fails closed the same way.

**3. One table drives both gates.** `ONBOARDED_APPS` lists the `appId` the
handlers accept and the origin CORS lets through, so an app cannot be onboarded
at one gate and not the other.

**4. The verifying key is derived from the signing key, not configured.** The
family service already holds `FAMILY_TOKEN_PRIVATE_KEY`; `createPublicKey` gives
its public half at boot. Consuming apps still get the public key as plain config
(spec §4.4), but the minting service deriving its own cannot drift from what it
signs with, and go-live gains no fifth variable.

**5. Quota refusals are `ValidationError`.** The domain taxonomy has no 413, and
a 400 naming the limit is the honest mapping for every cap below. A put prices
its own overwrite from one `saveUsage` query - `accountBytes - slotBytes +
newBytes` - so a full account can still rewrite the slot it already owns.

**6. Bytes are not the only resource, so slots are capped and `slotKey` is
bounded.** An empty blob costs zero bytes, and `slotKey` is the app's own
string, so a byte quota alone lets a token holder write unlimited rows that
`accountBytes` reports as nothing - hundreds of rows and a hundred kilobytes of
key material, all invisible to it. `MAX_ACCOUNT_SLOTS` therefore caps rows per
account (generous for a scene-per-slot app like silt, far above boop's one
slot), refusing only a **new** slot so a full account can still rewrite what it
holds, and the wire contract bounds `slotKey` at 128 characters. That bound also
keeps the key away from Postgres's btree index-entry limit, which would
otherwise turn an oversized key into a 500 on the primary key rather than a
clean 400.

## Consequences

The batch fan-out of one request is capped as well. tRPC leaves `maxBatchSize`
unlimited; Fastify's 100-character route-parameter default happens to bound a
batch near eleven procedures today, which is an accident of a framework default
rather than a limit this service ever stated, so `createAppServer` gained an
optional `maxBatchSize` and family sets it. The option defaults to tRPC's own
behaviour, so no other app changes; the rest of the estate is still bounded only
by that accident.

The quota check is read-then-write, not transactional: two concurrent puts can
each pass it and leave the account over the cap. The overshoot is bounded by the
per-slot limit times the number of simultaneous puts, the store method would have
to move the whole guard into the store to close it, and the cap is a courtesy to
the hoe-pg volume rather than a security control. Accepted and recorded.

`saves.accountId` is `text` with no FK ([ADR 0070](0070-family-service.md)), so
two spellings of one uuid are two accounts, and erasure - which matches
Postgres's canonical lowercase form - would leave the other spelling orphaned.
This is not reachable today, because the token's subject is minted from a
database read, but it is the structural price of the no-FK decision, so the
ownership tests pin both halves of it: a differently cased subject sees none of
the canonical account's saves, and a row written under one outlives the profile
delete.

There is still **no live dev path** for a real save. The simulator and the
`.iwft` harness serve `/api/trpc` alone and every request there is anonymous
(ADR 0078), and minting a token needs a cookie session that only
`docker compose up family` can produce. No dev-only shortcut was added, for the
same reason ADR 0078 added none.

The opaque-blob discipline is unchanged and absolute: the server measures
`blob` in bytes and never parses it. "Can the server query inside a save?" stays
the question to refuse in review.

**Amended 2026-11-10 (estate-gate ticket 04): `identity.saveSummary`.** Hub's
`/account` page shows a parent when each profile last saved, so the identity
router gained one read: for the asking parent and each of their child profiles,
every `appId` they have saved in and the newest `updatedAt` there. It is
metadata for the owning parent and the opaque-blob rule is intact: the store
selects `appId`, `accountId` and `max(updatedAt)` and nothing else, so no blob
is read, returned or parsed. It sits on the identity side rather than in the
save router because it spans a household and a family token names one account:
`requireParent` authorises it, the household is the one `deleteAccount` erases
(the parent's `user.id` plus `child_profiles` rows owned by it, matched as text
because `saves.accountId` has no FK), and the CORS tier is the identity one, so
an onboarded app origin can neither read the reply nor batch the procedure
behind a save call. A request carrying both credentials is answered for the
cookie session's parent, never the token's account.

## Amendment (2026-11-10): `expectedAccountId` refuses another profile's token

Estate-gate ticket 10. The token is a cookie every estate tab shares, so a tab
opened for one child sends a sibling's token as soon as another tab picks that
sibling. That tab would then overwrite the sibling's slot with the first child's
boops. The account still comes only from the token, as decided above.

What changes:

- `save.get`, `save.put` and `save.delete` take an optional `expectedAccountId`.
  When it is present and is not the token's account, the call is answered
  `CONFLICT` with `SAVE_ACCOUNT_MISMATCH` and nothing is read or written
  (`requireExpectedAccount` in `handlers/authz.ts`).
- The field only ever refuses: it never names an account to act on.

Why it is optional: so the client and the service can deploy in either order.
- An old client sends no field and is served as before.
- A new client against an old service still works, because a zod object strips
  keys it does not know. That service simply drops the field, so the binding
  does nothing until the service is redeployed.

`saveAccountBinding.test.ts` proves both orders over a real socket, against a
stand-in built on the old schema. The client half is
[ADR 0080](0080-boop-is-the-first-savestore-client.md)'s 2026-11-10 amendment.
