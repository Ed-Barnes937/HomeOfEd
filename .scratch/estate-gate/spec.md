# Estate gate - spec

**Status:** Draft (awaiting Ed)
**Related:** ADR 0057 (legal gate), 0070 (family service), 0078/0079 (auth
boundaries), 0080 (boop sync), 0081 (hub account UI), 0026/0075 (share links).

## Goal

Every app on `*.homeofed.com` requires a family session. A visitor without one
is sent to `homeofed.com/account`, signs in, picks who is playing, and lands
back where they were going. Share links stay open to anyone through one
ungated, non-persisting route per app. Once every session has a profile, local
saves belong to that profile.

## Decisions

1. **The gate is server-side, in `createAppServer`.** A request is a
   *document request* when it is GET/HEAD, not under `/api`, not `/health`, and
   its path has no file extension other than `.html`. A document request with
   no valid family token (any role; `verifyFamilyToken`, offline) is answered
   `302` to the account URL with `Cache-Control: no-store`. Assets and `/api`
   are not gated. `backend-kit` stays free of `@hoe/accounts`: it takes an
   injected `documentGate`, and `@hoe/accounts/server` builds one.
2. **The gate is on exactly when `FAMILY_ACCOUNT_URL` is set.** Production
   sets it in each app's `fly.toml` `[env]`; the docker stack sets it in
   `compose.yml`; `pnpm dev` (Vite) never runs `createAppServer`, so dev and
   `.iwft` are ungated. Rollout and rollback are one config line per app.
3. **Exempt apps:** hub (hosts `/account`), family, sprout and sprout-pipeline
   (own auth). espy's Capacitor shell never reaches the server, so it is
   unaffected.
4. **Redirect contract.** The gate sends
   `<FAMILY_ACCOUNT_URL>?returnTo=<absolute URL of the request>`. Hub accepts a
   `returnTo` only if its origin is in the estate registry (`ESTATE_APPS` in
   `@hoe/accounts`: exact production hosts; localhost dev and compose ports
   only when hub itself is on localhost). Anything else is dropped and hub
   behaves as if no `returnTo` was given. The browser carries the URL fragment
   to hub on its own; hub reattaches it on the way back.
5. **Public paths.** Each app may declare path prefixes the gate skips. The
   convention for fragment share links is `/shared`; fridge's server-backed
   board share keeps `/b/`.
6. **The shared view never persists.** `/shared#<payload>` opens the shared
   item, lets the visitor play and change it, and writes nothing to
   `localStorage` or the SaveStore. "Keep this" goes to the app root with the
   same fragment, which meets the gate. New share links point at `/shared`.
   Old root links (`/#g=...`, `/#w=...`) keep working for signed-in visitors;
   for everyone else hub's signed-out screen offers "Open what was shared",
   linking to `<returnTo origin>/shared<fragment>`. Hub knows no app's payload
   format, only that a fragment is present.
7. **Local saves are per profile.** `profileScopedKey(key, accountId)` in
   `@hoe/accounts` returns `key` unchanged for a null account and
   `key@<accountId>` otherwise. An app reads the account from
   `readFamilySession()`. SaveStore `slotKey`s do not change (the account is
   already part of the server key), so this amends the first-slice spec's
   "slotKey = localStorage key verbatim" on the local side only. Device-level
   preferences (themes, sim settings, hints, nudges) stay unscoped.
8. **Legacy device saves are copied, silently, into each profile.** The first
   time a profile opens an app on a device, the unscoped legacy document is
   copied to that profile's key (copy never move; the legacy key is never
   written again or deleted). No prompt.
9. **boop's import offer and decline state go away.** With decision 8, a
   signed-in profile always syncs. This closes two follow-ups: "how does a
   parent re-enable sync" and "the import offer is the one card a child meets
   unprompted".
10. **Switching player happens at hub only.** Apps link to
    `accountUrl(returnTo)`; no app grows its own picker.
11. **Silent renewal.** Hub remembers the last picked profile per device. When
    a visitor arrives with a valid `returnTo`, no family token, a live parent
    session and a remembered profile that still exists, hub re-mints and
    returns without showing a screen.
12. **A parent learns about sync on `/account` only**, as a last-saved time per
    profile and app. Nothing is ever shown in an app.
13. **Rate limit:** a plain message and a briefly disabled button. No countdown.
14. **`onboardedApps.ts` keeps `devPort` as a literal.** No environment
    variable.

## Open calls for Ed (defaults above are built unless changed)

- Decision 8/9: silent copy into every profile, and removing boop's offer.
- Decision 6: a shared item can be changed but not kept without an account.
- silt: copying scenes and thumbnails per profile may hit the `localStorage`
  quota. Ticket 12 measures first; the fallback is that only the first profile
  on a device adopts the legacy scenes.

## Risks to keep in view

- The estate becomes invite-only in practice (ADR 0057 unchanged). Family
  being down now blocks a new device from playing; an existing token still
  works offline for its 30 days.
- `fastify.inject()` does not share the HTTP parser's semantics
  (`packages/backend-kit/README.md`): gate tests bind a real port.
- Post-deploy smoke fetches `/` and greps for an asset; a gated app answers
  `302`. Ticket 03 fixes the smoke before any app turns the gate on.
- A deleted profile's token passes the gate until it expires
  (`.scratch/family-first-slice/issues/10-deleted-profile-tokens.md`, not part
  of this epic).

## ADR numbers (pre-assigned so parallel tickets cannot collide)

- 0093 estate gate (ticket 02 writes it, covering decisions 1-6, 10).
- 0094 per-profile local saves (ticket 01, decisions 7-9).
- 0095 hub return and renewal (ticket 05, amended by 06).
- 0081 and 0080 are amended in place by the hub and boop tickets.

## Waves

| Wave | Tickets | Notes |
|---|---|---|
| 1 | 01, 02, 03, 04, 07 | no dependencies, all parallel |
| 2 | 05, 10, 16, 18, then 19 | parallel: hub return flow, boop (the reference app), starter and docs, docker-stack sign-in; 19 (verifying key) follows 18 and gates boop's wiring |
| 3 | 06, 11, 12, 13, 14, 15 | parallel: hub renewal, and the other apps copying boop's merged pattern |
| 4 | 08, 09 | parallel: hub `/account`, different components |
| 5 | 17 | Ed's pilot on boop, then the other apps' gates merge |

Ticket 10 (boop) merges only after 05 is live. The docker-stack round trips
in 05 and 10 need ticket 18; build the rest first and run that check once 18
is in. Tickets 11-15 start once 10 is
merged, so they copy real code, and they merge after 17; waiting for 10 costs
nothing because they could not merge before the pilot anyway.

## For implementers

You start with no context beyond the repo. Read, in order: the root
`CLAUDE.md`, this spec, your ticket, the `CLAUDE.md` or `README.md` of every
app or package you touch, and the ADRs your ticket names.

- **Scope.** Your ticket only. If it names files you must not touch, another
  ticket owns them. Do not take an ADR number other than the ones assigned
  above.
- **Branch and PR.** `estate-gate/NN-<slug>` off `main`, one PR per ticket
  against `main`. If a blocker is built but unmerged, branch from it and say
  so in the PR. Open the PR and leave merging to Ed: a merge to `main` deploys.
  Never `--admin`.
- **Verify loop.** `pnpm lint`, `pnpm typecheck`, and
  `pnpm --filter <package> run test` for everything you touched. Do not use
  `turbo run --filter=<app>`; it fails on a cyclic dependency.
- **Tests.** Test first. `.iwft` for state seen through the UI, unit tests for
  the layer below; do not duplicate one in the other. Fakes over mocks.
  Anything asserting transport behaviour (status, headers, redirects, content
  type) binds a real port. Anything asserting what Better Auth does is checked
  once against `docker compose up family` before a fake is taught to copy it.
- **Docker stack.** Host ports 8082 and 8083 may be held by unrelated
  containers on this machine; that is not your bug.
- **Code style.** Match the surrounding code. A comment is one or two lines
  for something obscure; reasoning goes in the ADR.
- **Writing.** No em dashes anywhere. No `Co-Authored-By` line in commits.
  Never edit a `CHANGELOG.md` or a generated file.
- **Infrastructure.** Editing `fly.toml`, `compose.yml` and workflows is fine
  where your ticket says so. Never run `fly` or Cloudflare commands.
- **When the ticket says stop, stop.** Write what you found under the
  ticket's `## Comments` and report back; do not pick the fallback yourself.
- **When done.** Set the ticket's `Status:` to `resolved`, add a short comment
  with anything you did differently from the ticket and why, and report: PR
  link, what you ran and its result, deviations, anything you could not
  verify.
