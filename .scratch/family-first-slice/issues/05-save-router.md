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

- 2026-11-09: **built** on branch `family-first-slice` (on top of ticket 04's
  `760f2f0`), commits `6347939`, `d691be3`, `9986117`.

  **What landed.** `save.get/put/list/delete` under `createAppRouter`, each
  taking its input schema from `@hoe/accounts` and bound through a
  `saveContractFor(ctx)` object that `satisfies FamilySaveContract`. Four
  handler classes in `handlers/saves/`, `requireSaveAccount` and
  `requireOnboardedApp` in `handlers/authz.ts` beside ticket 04's guards,
  `onboardedApps.ts` as the single onboarded-app table, `saveUsage` on the
  Store, and a second CORS tier. 22 new vitest tests in `saves.test.ts`, 8 in
  `auth/familySeam.test.ts`, 4 store tests and 13 CORS tests; 168 vitest + 3
  iwft pass for family, 30 for `@hoe/accounts`; lint and typecheck green.

  **The seam had to carry both credentials, not rank them.** Ticket 04 sketched
  a flat family-token user on `ctx.auth`, which cannot work: the Better Auth
  cookie is host-scoped to `family.homeofed.com` and the token cookie to
  `.homeofed.com`, so a parent signed in on hub who has picked which child is
  playing sends **both on every save**, naming **different people**. Preferring
  the token locks that parent out of profile management; preferring the session
  breaks the one flow the SaveStore exists for. So `familySeam` resolves both
  independently and keeps them in separate fields - `id` + `kind` for the
  session, a nested `saveAccount` for the token - and each guard reads only its
  own. No save handler may read `user.id`. ADR 0079 records this; ADR 0078's
  decisions are untouched and `requireParent` is unchanged.

  **The CORS tier refuses a mixed tRPC batch**, and that turned out to matter in
  practice rather than in theory: tRPC's Fastify adapter dispatches
  `/api/trpc/save.get%2Cidentity.me?batch=1` as a real two-procedure batch in
  the production image, so the tier is chosen only when every procedure name in
  the path matches `save.<identifier>` - a pattern that admits no
  percent-encoding. Without it an app origin would have been granted CORS on a
  batch carrying `identity.deleteAccount`.

  **The quota query is new store surface, as ticket 03's review expected.**
  `saveUsage(key)` returns `accountBytes` across every appId plus that slot's
  share, so a put prices its own overwrite by the difference and a full account
  can still rewrite what it already owns. The check is read-then-write; the
  concurrent overshoot is bounded by the slot cap and is accepted in ADR 0079.

  **Deviations.**
  1. **The verifying key is derived from `FAMILY_TOKEN_PRIVATE_KEY` at boot**
     (`createPublicKey`), not configured. Spec §4.4 ships the public key as
     config for *consuming* apps; the minting service deriving its own cannot
     drift from what it signs with, and go-live gains no fifth variable.
  2. **The save CORS tier is a superset of the identity tier** rather than a
     disjoint list, which is spec §4.5's literal reading (apex plus onboarded
     app origins). Hub already mints the token it would be using, so it adds no
     risk, and the identity list itself is untouched.
  3. **Quota and allowlist refusals are `ValidationError` (400).** The domain
     taxonomy has no 413; the messages name the limit.
  4. **The dev simulator stays anonymous** - no token seam there. Minting needs
     a cookie session that only `docker compose up family` can produce, so
     wiring it would buy nothing and ADR 0078 refuses dev-only shortcuts.

  **The ownership tests carry the 2026-11-09 note.** A subject differing only in
  case is a different account (`get`/`list` see nothing of the canonical one),
  and a row written under a non-canonical form of a child's uuid outlives
  `deleteChildProfile` - the structural price of the no-FK decision, now pinned
  rather than resting on a comment.

  **Verified end to end against the real image**, `docker compose up family`
  with real Postgres on host 8090: anonymous `save.get` → 401; a child token
  round-tripped a blob and bumped to version 2; a second child's token saw
  `null`, an empty list and a no-op delete; `appId: 'silt'` → 400; the slot cap
  refused 262145 bytes and accepted 262144; the account cap refused the put
  that would have crossed 2 MiB and still allowed rewriting an owned slot; a
  **real Better Auth cookie session alone was refused by `save.get` and
  `save.put` while `identity.me` resolved it**, and with cookie and token on one
  request `identity.me` answered for the parent while `save.get` answered for
  the child; preflights granted `https://boop.homeofed.com` the save routes but
  nothing on `identity.deleteAccount`, `/api/auth/sign-in/email`, a mixed batch
  or its percent-encoded form, while `http://localhost:3008` got nothing under
  `NODE_ENV=production`; `psql` showed every row under the token's subject with
  `blob` still `text`; and no blob content reached the logs.

  **Open question for Ed** is in the hand-back: whether the save tier should
  also list hub's dev origin pair for a future hub "what's synced" panel, or
  stay as it is.

- 2026-11-09: **review fixes applied**, commits `b8b552c`, `e60917d`, `81feec5`.
  The high-severity finding is ticket 04's, not this ticket's, but it is closed
  here because it is one boundary across both routers.

  **The hole, reproduced before it was fixed.** CORS response headers govern
  what a browser may **read**, never what it may **send**. A CORS-simple request
  - `multipart/form-data`, `application/x-www-form-urlencoded` or `text/plain` -
  carries no preflight at all, so the allowlist is never consulted; the mutation
  commits and the attacker discards the reply it may not read. Against the real
  image, a `multipart/form-data` POST to `identity.deleteAccount` from
  `https://boop.homeofed.com`, carrying nothing but the victim's cookie,
  returned **`200 OK` and took the household from 1 user to 0**, indifferent to
  the Origin header. It was reachable because that was the service's only
  mutation with no `.input()`, and a procedure without an input parser never
  reads the request body, so tRPC's lazily-read multipart body was never
  touched. `text/plain`, urlencoded and a missing content-type were already
  refused 415 by Fastify's own parser, so multipart was the single live vector.

  **`app.inject` hid it.** Inject builds a synthetic `Request` whose body the
  multipart path cannot read, and reports `500 Converting circular structure to
  JSON` with the household intact - a green-looking refusal where the live
  server erases the data. `csrf.test.ts` therefore binds a real port and uses
  real `fetch`. That is the second time in this epic inject has misrepresented
  the pipeline (ticket 04's reviewer hit it on duplicate headers).

  **The fix is the boundary, not the instance.** A Fastify hook refuses any
  non-GET `/api/trpc` request whose content type does not begin
  `application/json` - a type no safelisted value satisfies, so a browser is
  forced into the preflight the allowlist then governs. `deleteAccount` also
  took an input schema (`{ confirm: true }`), which makes tRPC read the body,
  but that is defence in depth: the next input-less mutation would reopen the
  same door and only the hook closes it for all of them. **Note for ticket 06:
  hub's account UI must send `{ confirm: true }` to erase a household.**

  **`/api/auth/*` was already covered, and is now stated.** Better Auth's origin
  check is global over every non-GET route, not per-route, and refuses a missing
  origin as well as an untrusted one whenever the request carries a cookie -
  verified in the image across `sign-out`, `update-user`, `change-password`,
  `delete-user` and `change-email`. But it is **off by default under
  `NODE_ENV=test`** (`skipOriginCheck: ... : isTest() ? true : false`), so no
  vitest test could see it. `betterAuth.ts` now sets
  `advanced.disableOriginCheck: false` explicitly, which deliberately turned
  ADR 0057's whole-option-set assertion red; that list now carries `advanced`
  and says why.

  **The four smaller fixes.**
  1. `slotKey` is bounded at 128 characters in the contract, and
     `MAX_ACCOUNT_SLOTS = 64` caps rows per account - refusing only a **new**
     slot, so a full account can still rewrite what it holds. `saveUsage` now
     returns `accountSlots` and `slotExists` for it. Demonstrated in the image:
     64 rows holding **1 byte** between them, the 65th refused by name. The
     btree caveat is moot behind the 128 bound - a 129-character key is a clean
     400 from zod, not a 500 from the primary key.
  2. `maxBatchSize` is now an optional `createAppServer` opt (defaulting to
     tRPC's own unlimited, so no other app changes) and family sets 10. Verified
     in the image: 10 procedures pass, 11 are refused, and so is the
     percent-encoded form. **Correction to the finding's magnitude**: the fan-out
     was never ~1000, because Fastify's 100-character `maxParamLength` default
     caps a batch near eleven today. That is a framework accident, not a stated
     limit, which is why the cap is still worth having.
  3. The `saveUsage` test gap is closed: a row with the **same** `slotKey` under
     a different `appId` now pins the `appId` half of the slot filter, plus an
     empty slot that only the row count notices.
  4. ADR 0079 no longer implies the tier split protects the token surface. It
     cannot: the token is deliberately JS-readable on every estate origin, so an
     XSS anywhere exfiltrates it and a non-browser client then uses it from
     anywhere; the real controls are the signature and the TTL (ADR 0057 item
     5). The tier exists so the wider list cannot become a door to the
     cookie-authorised router.

  **Recorded in the ADRs.** The read-versus-send misconception is ADR 0078
  **decision 5**, because it spans both routers, with ADR 0079 cross-referencing
  it; the new caps and the batch cap are in ADR 0079. The scoped `CLAUDE.md`
  carries both invariants: do not remove the hook, and do not add an input-less
  mutation.

  **Verify**: family 202 vitest + 3 iwft, `@hoe/accounts` 33, `@hoe/backend-kit`
  33, lint and typecheck green for all three; hub and boop typecheck green as a
  smoke over the additive backend-kit opt.
