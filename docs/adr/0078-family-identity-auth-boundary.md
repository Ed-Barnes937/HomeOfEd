# 0078 - the family service's identity boundary: two credentials, one seam, and a narrow door

- **Status:** Accepted
- **Date:** 2026-11-09 (decision 5 added 2026-11-09 during ticket 05; decision
  6 added 2026-11-10 by estate-gate ticket 18)
- **Related:** [ADR 0070](0070-family-service.md) (the family service this
  implements), [ADR 0057](0057-family-service-legal-gate.md) (the invite gate,
  whose mechanism depends on decision 4 below), [ADR 0012](0012-sprout-app-owned-auth.md)
  (sprout's two-identities-one-seam precedent, generalised here),
  [ADR 0088](0088-deploy-guard-package.md) (decision 4's placeholder rule, now
  `@hoe/deploy-guard`, extended to sprout and sprout-pipeline),
  [ADR 0008](0008-apps-without-a-database.md) (auth does not imply a database),
  [ADR 0079](0079-family-save-authorisation.md) (the save half, which found the
  hole decision 5 closes).
  Implements first-slice ticket 04; the design is
  [the first-slice spec](../../.scratch/family-first-slice/spec.md) §4.2-§4.5.

## Context

[ADR 0070](0070-family-service.md) settled what the family service is. Building
its identity half surfaced four decisions it did not anticipate, each of which a
later ticket can silently undo.

The root of three of them is that the service answers to **two different
credentials**. Identity work - managing child profiles, minting a session token,
erasing a household - is authorised by a Better Auth **cookie session**, used
only from hub's account page. Saves are authorised by the **family session
token**, a signed claim set that every app verifies offline. Both arrive on the
same request and both resolve through backend-kit's one `ctx.auth` seam, whose
`AuthProvider.getUser()` is synchronous and returns `User = { id }`.

Those two credentials are not equally trustworthy. The family token is
deliberately **not** httpOnly ([ADR 0070](0070-family-service.md), spec §4.4):
hub sets it client-side and any script on any `*.homeofed.com` page can read it.
The cookie session is httpOnly and host-scoped to `family.homeofed.com`. Treating
them alike would let the weaker one do the stronger one's work.

The fourth decision is about who may knock at all. Every subdomain of
`homeofed.com` is **same-site**, so `SameSite=Lax` does not stop a cookie
travelling from one estate app to another on a `credentials: 'include'` fetch.
CORS is therefore the only barrier in front of this service, and the first cut of
it was a single allowlist shared by every route.

## Decision

**1. The two credentials are distinguished by a marker, not by shape.** A
resolved cookie session carries `kind: 'parent-session'`, and `requireParent`
accepts nothing else. A family-token user carries `role`, `parentId` and `name`
and no `kind`, so it can never satisfy an identity procedure however the two
providers are wired later. Every identity handler has a test feeding it a
family-token-shaped user and expecting `UNAUTHORIZED`.

This is the invariant the save router must not relax. Widening `requireParent`
to accept a `role: 'parent'` token would let any script on any estate subdomain
read a token out of a cookie and erase the household with it.

**2. The async session reaches the synchronous seam through a server-stamped
header.** `auth.api.getSession` is a database call; `getUser()` is synchronous.
A Fastify `onRequest` hook therefore resolves the session and writes the parent
id into `x-family-parent` for `/api/trpc` requests, **having first deleted any
inbound value unconditionally**. That delete is the whole anti-spoof story, so it
lives in one small module with a test that drives the real pipeline. This is
sprout's `x-sprout-parent` mechanism ([ADR 0012](0012-sprout-app-owned-auth.md))
reused rather than reinvented.

**3. CORS is hand-rolled, and split by what the route authorises.** Identity and
`/api/auth/*` allow **the hub account UI alone** (`https://homeofed.com`, plus
localhost dev servers outside production). Onboarded app origins belong to the
save router and arrive with it, not before. The allowlist is config, never `*`,
and never reflects an unchecked origin; `trustedOrigins` is wired to the same
list so Better Auth's own CSRF check cannot disagree with it.

It is hand-rolled rather than `@fastify/cors` because an app has no direct
`fastify` dependency by backend-kit's design, and an auto-installed peer risks a
second Fastify instance decorating a different app object.

**5. The allowlist governs READING a reply, never SENDING a request, so
`/api/trpc` also requires `content-type: application/json`.** This decision was
added during ticket 05, correcting a misconception in decisions 3 and 4: a
CORS-simple request - one whose content type is `multipart/form-data`,
`application/x-www-form-urlencoded` or `text/plain` - carries **no preflight at
all**, so the allowlist is never consulted. The mutation commits, and the
attacker discards the response it is not allowed to read.

That was not hypothetical. `identity.deleteAccount` was tRPC's only mutation
with no `.input()`, and a procedure without an input parser never reads the
request body, so the unparseable multipart body was never touched and the
handler ran. Against the production image, a `multipart/form-data` POST from
`https://boop.homeofed.com` carrying nothing but the victim's cookie returned
`200 OK` and erased the household irreversibly, indifferent to the Origin
header. Every estate subdomain is same-**site**, and `SameSite=Lax` restricts
cross-site rather than cross-origin, so the cookie travelled.

The fix is a boundary, not a patch of that one procedure: a Fastify hook refuses
any non-GET `/api/trpc` request whose content type does not begin
`application/json`. No safelisted content type matches it, so a browser is
forced into a preflight, which the allowlist then governs - restoring the
property decisions 3 and 4 were written believing they already had. The tRPC
client and `@hoe/accounts`' save client both already send that header, and tRPC
maps every mutation to POST (`allowMethodOverride` defaults false, and applies
only to POST in any case), so GET stays unguarded and mutates nothing.
`deleteAccount` also gained an input schema, which makes tRPC read the body, but
that is defence in depth: the next input-less mutation would reopen the same
door, and only the hook closes it for all of them.

`/api/auth/*` is not covered by that hook and does not need to be: Better Auth
runs its own origin check, server-side and independent of CORS. It is global
over every non-GET route rather than per-route, refusing both an untrusted
origin and a missing one whenever the request carries a cookie - verified across
`sign-out`, `update-user`, `change-password`, `delete-user` and `change-email`.
It is, however, **off by default under `NODE_ENV=test`**, so this service sets
`advanced.disableOriginCheck: false` explicitly rather than inheriting a default
that flips with the environment; without that the control is invisible to any
test that tries to pin it.

**4. Anything this repo publishes refuses to boot on Fly.** All four identity
variables are required unconditionally, so a missing secret crashes the process
at boot rather than failing the first sign-in. Beyond that, when `FLY_APP_NAME`
is present the loader also refuses: the committed `@hoe/accounts/testing` signing
key (compared against the imported constant, so the guard cannot drift from the
fixture), any `REGISTRATION_INVITE_CODE` or `BETTER_AUTH_SECRET` that reads as a
placeholder, either of those below a minimum length, and any `NODE_ENV` but
`production`.

The placeholder rule is a **pattern**, not a list of known values, and that
choice is the decision. A list keyed to hand-picked files can only enumerate
what somebody remembered: `apps/sprout/.env.example` publishes a 32-character
`dev-better-auth-secret-change-me` that cleared an enumerated list, a per-file
drift scan and a 32-character floor all at once. Since sprout is the Better Auth
precedent this service followed, it is exactly what an operator would copy, and
a public cookie-signing secret is worse than a public invite code: it forges a
session for any parent id and drives the whole identity router without
registering at all. A false positive fails closed and is fixed by generating a
different secret, which is the safe direction to be wrong in.

`BETTER_AUTH_URL` is the fourth variable and lives in `fly.toml`'s `[env]`, not
in a Fly secret: Better Auth derives its cookie rules and origin checks from it,
it is not sensitive, and keeping it out of `fly secrets set` means go-live gains
no new human step.

**6. The docker stack's origins are a compose-only switch that Fly refuses.**
Added by estate-gate ticket 18. The docker stack runs the production image, so
`NODE_ENV` is `production` there and decision 3's dev origins are off: hub on
`http://localhost:8080` was refused at the preflight, and Better Auth refused
its sign-up as `INVALID_ORIGIN`, because `trustedOrigins` is the same list.
Turning `NODE_ENV` down would not have helped either (the dev list is the Vite
ports, not compose's), and it would have switched on everything else that keys
off it.

`DOCKER_STACK_ORIGINS=on`, set in `compose.yml` alone, adds the stack's own
origins with the two tiers kept exactly as in production: the identity tier
(and so `trustedOrigins`) gains hub's compose origin `http://localhost:8080`
and nothing else, and the save tier additionally gains each onboarded app's
compose port from `onboardedApps.ts` (`composePort`, a literal like `devPort`).
No other localhost port is admitted. The value is parsed as the literal `on`,
so a typo crashes the boot rather than being read as off, and
`@hoe/deploy-guard`'s new `localOnly` list refuses the variable at any value
when `FLY_APP_NAME` is set, so it cannot reach Fly unnoticed: the deploy fails
at boot. A test pins that `fly.toml` never sets it, and a real-socket test
pins that the production configuration still grants no localhost origin
anything. Hub and boop find the stack's family (host port 8092) from their own
compose ports at runtime; their production URL is unchanged, since that branch
is taken only on a localhost hostname. `scripts/docker-stack-sign-in.mjs` is
the repeatable proof.

## Consequences

The `kind` marker is a convention a reviewer must defend, because the type system
cannot: `AuthProvider.getUser()` returns `User`, and every app extends it by
intersection. The scoped `apps/family/CLAUDE.md` states the invariant, and the
tests are what will actually catch a regression.

Better Auth runs in the production entrypoint only. The dev simulator and the
`.iwft` harness serve `/api/trpc` alone, so every request there is anonymous and
the identity procedures refuse; token minting is `node:crypto` and throws in the
browser harness. Hub's account flows are therefore covered by `FakeFamilyClient`,
and the real `/api/auth/*` path by a Vitest suite over the real Better Auth
instance plus the docker stack. **There is no live dev path for a real sign-in
short of `docker compose up family`**, and no dev-only shortcut was added,
because a "stamp a parent" backdoor is precisely the thing this ADR exists to
prevent.

The invite gate is route-enumerated: it matches `ctx.path === '/sign-up/email'`.
That is complete for the options configured, but a social provider or one of the
anonymous, magic-link, email-otp, phone-number or admin plugins would open
another path to `createUser` that the hook never sees. Since
[ADR 0057](0057-family-service-legal-gate.md) rests entirely on this gate, the
option set is asserted whole in a test, so adding any option turns it red.

Two limits are accepted and recorded rather than fixed. `Vary: Origin` does not
survive on tRPC responses, because tRPC's adapter writes its own straight to the
raw response - so **no cache rule may ever cover `/api/trpc`**, and that belongs
in the go-live runbook. And the deployment guard normalises whitespace only, so a
semantically re-encoded form of the committed key would pass it; no accident
produces one, and the guard is defence in depth behind a real secret, not the
primary control.
