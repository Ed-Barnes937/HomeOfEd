# 0070 - the family service: one minter, a central SaveStore, and browser-direct saves

- **Status:** Accepted
- **Date:** 2026-09-28
- **Related:** [ADR 0008](0008-apps-without-a-database.md) (this is the
  "separate future ADR" that one deferred), [ADR 0012](0012-sprout-app-owned-auth.md)
  (the provider seam sprout swaps in through),
  [ADR 0057](0057-family-service-legal-gate.md) (the legal gate, still Proposed),
  [ADR 0001](0001-foundation.md) (one app per Fly app). Implements decision 05
  of the [account-infra map](../../.scratch/account-infra-discovery/map.md);
  the design it follows is [the first-slice spec](../../.scratch/family-first-slice/spec.md).

## Context

Seven apps in the estate keep a child's work in `localStorage`, which means the
work is stuck on whichever browser made it. Wanting the same boop on the tablet
and the laptop is what reopened accounts, and the discovery effort ended in a
decision sitting on 2026-09-10 that took thirteen decisions at once.

The estate's existing shape constrains the answer more than the requirement
does. Apps are leaf nodes that never import each other, most of them are
stateless by [ADR 0008](0008-apps-without-a-database.md), and they scale to zero
so that the whole estate costs about $13 a month. Any account layer that forces
every app to gain a database, a secret, or a warm machine would undo all three.

Four options were weighed in the discovery paper. Folding identity into hub was
rejected because it makes hub critical and forfeits letting hub scale to zero.
Giving each app its own accounts was rejected on the same grounds as the
localStorage status quo, since it fragments the child across apps. Reusing
sprout's auth was rejected because sprout's is deliberately specialised to its
own safety model.

## Decision

Build one fresh, minimal service, `apps/family`, deployed as a single
scale-to-zero Fly app (`hoe-family`, London) with a logical `family` database in
the shared `hoe-pg` cluster. Three choices inside it carry the design.

**The service alone can mint; every app verifies alone.** The family service
holds an Ed25519 private key as a Fly secret and is the only process in the
estate that can sign a session token. The public half ships as ordinary config
inside `@hoe/accounts`, so a consuming app verifies a signature locally. That
asymmetry is what keeps the cost of onboarding an app at one import and one line
of wiring: no network call, no database, and no new Fly secret. It is also why
the token is Ed25519 rather than a shared HMAC secret, which would have handed
every app the power to mint.

**Verification is total.** `verifyFamilyToken` returns `null` for a malformed,
tampered or expired token and never throws, because an unauthenticated request
has to resolve to "no user" rather than a 500. Apps read the result through the
existing `ctx.auth.getUser()` seam, which is the promise [ADR 0008](0008-apps-without-a-database.md)
made when it said auth does not imply a database.

**Saves go browser-direct.** An app's SPA calls this service's tRPC directly
rather than proxying through its own backend, so a save never wakes the owning
app's machine. Saves are opaque versioned blobs keyed `(appId, accountId,
slotKey)`, where `slotKey` is the app's own `localStorage` key used verbatim.
The server never parses a blob and never grows an app-specific column.

**The database stays in shared `hoe-pg`, with no backups, for the household
pilot.** [ADR 0072](0072-sprout-owns-its-postgres-and-triggers-are-scopes.md)
moved sprout to its own unmanaged cluster and set a trigger that a household
pilot fires, so this choice is a deliberate divergence rather than an oversight.
Its decision 4 requires the price: Managed Postgres has no small tier, so the
alternative starts at $38/mo at Basic (as of 2026-11-02) against roughly $16/mo
for the whole estate today, and sprout's own-cluster-with-backups shape costs
about $4.48/mo of which the separate cluster is $1.91 and the 512MB that
`--enable-backups` demands is $1.76. The owner accepted no backups on 2026-11-09
on the grounds that the pilot cohort is the owner's household, which is also
what [ADR 0057](0057-family-service-legal-gate.md) scopes. What a lost database
costs here is narrower than it looks: the account list and the service's copies
of each save, never a child's actual work, because every app's `localStorage`
remains the source of truth. The restore rehearsal ADR 0072 handed forward is
therefore deferred rather than closed, and it returns as a precondition the
moment a non-household account exists. It ran and passed on 2026-11-10, and
[ADR 0089](0089-hoe-pg-offsite-backups-on-r2.md) adds a nightly off-Fly dump.

**The cluster did not isolate family from its neighbours, and
[ADR 0086](0086-hoe-pg-least-privilege.md) ends that.** `fly postgres attach`
grants superuser by default, so on 2026-11-09 `hoe_fridge`, `hoe_hub` and
`hoe_wotd` were each a superuser able to read and write the `family` database:
parents' emails and password hashes, children's usernames, and every save.
ADR 0086 makes every app role an ordinary user that owns only its own database.

Child profiles are rows a parent owns rather than accounts of their own, so
there are no child credentials to lose. `saves.accountId` deliberately carries
no foreign key, because it holds either a parent's `user.id` or a
`child_profiles.id`; erasure is therefore explicit and transactional.

## Consequences

Hub owns every account screen, which keeps future monetisation gating in one
place: the gate screens would be hub's, and enforcement is a claim check at each
app's `ctx.auth`. Apps stay stateless and keep scaling to zero, and boop is the
first slice with silt deliberately second, so the 256 KiB slot cap gets
renegotiated against a real case rather than a guessed one. Sprout is untouched
and swaps in later through its [ADR 0012](0012-sprout-app-owned-auth.md) provider
path.

The costs are real and accepted. The family service becomes a single point of
failure for signing in, though not for playing, since a verified token keeps
working offline for its 30-day life and every app's `localStorage` stays the
source of truth. There is no sync engine: a whole slot is saved and loaded at
once, the newest write wins, and one app-owned merge hook runs at import, so a
save deleted on one device can reappear from another. That is acceptable for a
household and would not be for strangers, which is exactly the boundary
[ADR 0057](0057-family-service-legal-gate.md) polices.

The opaque-blob discipline has to be defended in review rather than by the type
system. "Can the server query inside a save?" is the question that would quietly
turn this into an app-shaped data server, and the answer is no.

## Amendment (2026-11-10): where an app gets the public key

"The public half ships as ordinary config inside `@hoe/accounts`" becomes
concrete for the estate gate ([spec](../../.scratch/estate-gate/spec.md)
decision 1). `@hoe/accounts/server` exports `familyVerifyingKey(env)`, the
`publicKeyPem` every gated app hands to `familyDocumentGate`.

- **Production key: a committed constant**, `PRODUCTION_FAMILY_PUBLIC_KEY` in
  `packages/accounts/src/familyVerifyingKey.ts`. A public key is safe to commit,
  and a constant keeps the promise above: no new Fly secret or variable per app.
  It is `null` until Ed commits it, and a test checks that whenever it is set it
  is an Ed25519 public key the gate accepts and not the test key.
- **`FAMILY_TOKEN_PUBLIC_KEY` overrides it.** The docker stack's family signs
  with the committed `@hoe/accounts/testing` key, so a built-in production key
  alone would bounce every compose app between itself and hub. `compose.yml`
  sets the test public half on the eight gated services, and a drift test
  checks it matches the private key compose's family signs with. Escaped `\n`
  are unescaped, as for `FAMILY_TOKEN_PRIVATE_KEY`.
- **On Fly, the test key is refused at boot** (`isDeployed` from
  `@hoe/deploy-guard`, the rule of [ADR 0078](0078-family-identity-auth-boundary.md)
  decision 4 and [ADR 0088](0088-deploy-guard-package.md)): its private half is
  public, so anyone could mint a token that passes the gate. Keys compare as
  SPKI, so line wrapping cannot slip one past. With no override and no
  committed constant it also refuses, on or off Fly, naming both remedies.
- **Resolved only when the gate is on.** An app calls `familyVerifyingKey` only
  inside its `FAMILY_ACCOUNT_URL` branch, so an app with the gate off boots
  exactly as before, key or no key. Turning the gate on in production
  therefore needs the constant committed first.
