# 04 - identity router: Better Auth, invite gate, token minting

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md) §4.2, §4.3, §4.4 (mint side), §4.5
Blocked by: 01, 03

The identity half of the family service.

- `better-auth` (sprout's version line), Drizzle adapter over the injected
  `DbClient<FamilySchema>`, `emailAndPassword` enabled; `/api/auth/*`
  forwarded through Fastify to `auth.handler()` (sprout precedent).
- Registration closed behind `REGISTRATION_INVITE_CODE`: `hooks.before` on
  `/sign-up/email`, secret required in prod with boot-crash if missing
  (`main.ts` posture; ADR 0057 records this as the legal gate's mechanism).
- Identity tRPC router, authorised by the Better Auth cookie session
  (host-scoped to `family.homeofed.com`, used only by hub's account UI):
  `me`, children CRUD, `mintSessionToken` (parent self or one of their own
  child profiles - mints the Ed25519 family token via `@hoe/accounts`),
  `deleteAccount` (transactional erasure via ticket 03).
- Ownership guards: a parent can only touch their own children; a parent
  cannot mint for another family's child (typed errors).
- CORS: explicit origin allowlist config (`https://homeofed.com`,
  onboarded `https://<app>.homeofed.com`, `http://localhost:<port>` in dev)
  with `Access-Control-Allow-Credentials: true` - config, never `*`.

TDD: handler unit tests over `freshTestDb` - invite-code rejection, children
CRUD ownership, mint-for-foreign-child rejection, erasure. Token internals
are ticket 01's tests; here test the wiring.

## Comments

- 2026-11-09: **added requirement, from ticket 03's review.** Deleting a child
  profile must be transactional and must leave no orphan saves, exactly as
  `deleteAccount` is.

  Why this needs saying explicitly. `saves.accountId` deliberately carries no
  foreign key, because it holds either a parent `user.id` or a
  `child_profiles.id`. A plain `delete from child_profiles where id = $1`
  therefore strands that child's save rows permanently: nothing left in the
  database can ever reference them, and no join will surface them. The FK
  cascade that would ordinarily prevent this is precisely what ticket 03 gave
  up, and `deleteAccount` is transactional for exactly this reason.

  This ticket currently asks only for "children CRUD", and its test list reads
  "invite-code rejection, children CRUD ownership, mint-for-foreign-child
  rejection, erasure", none of which catches the orphan. Add a store method
  that deletes the profile and that `accountId`'s `saves` rows in one
  transaction, plus a test pinning that no orphan saves survive. Ticket 03's
  `deleteAccount` and its rollback test are the pattern to follow.

- 2026-11-09: **built** on branch `family-first-slice` (on top of ticket 03's
  `724a622`), commit `d3d424b`.

  **What landed.** `createAppRouter(deps)` over `createTRPC<FamilyStore>()`,
  with the Store injected into all three transports; Better Auth `^1.6.2` over
  the same `DbClient` with `/api/auth/*` relayed through Fastify; the invite
  gate as a `hooks.before` on `/sign-up/email`; `identity.me`,
  `children.list/add/rename/delete`, `mintSessionToken` and `deleteAccount`;
  `cors.ts`'s allowlist; and `loadFamilyEnv`'s boot guard over the four
  identity variables. 67 vitest tests and 3 iwft pass; lint and typecheck green.

  **The auth boundary, stated plainly.** Identity is authorised by the Better
  Auth cookie session, the save router will be authorised by the family token,
  and both land on one `ctx.auth`. A parent session therefore carries
  `kind: 'parent-session'` and `requireParent` accepts nothing else, so a
  family token can never reach children CRUD, a mint or an erasure. Resolving
  the session is async and the seam is not, so a Fastify `onRequest` hook
  stamps a server-trusted `x-family-parent` header after deleting any inbound
  value (sprout's ADR 0012 precedent); that strip has its own module and test.

  **The added requirement is done.** `deleteChildProfile` deletes the profile
  scoped to `(id, parentId)` and, only for a row it really owned, that
  `accountId`'s `saves` rows, both in one transaction. The scoping is as
  load-bearing as the atomicity: an unscoped saves delete would wipe another
  household's rows. Pinned by three store tests (no orphans, rollback, foreign
  household no-op) and two handler tests.

  **Verified end to end against the real image**, not only the unit suites:
  `docker compose up family` refused a sign-up with no code and one with the
  wrong code while leaving `user` empty, accepted the third, resolved
  `identity.me` from the cookie, resolved a forged `x-family-parent` to nobody,
  minted both token shapes (verified against the committed test public key, so
  the escaped-newline PEM path is proven), answered an allowlisted preflight
  with the credentialled headers and gave an unlisted origin none, and against
  real Postgres took exactly one child's save rows on a child delete and left
  no rows at all after `deleteAccount`.

  **Deviations, all deliberate.**
  1. `BETTER_AUTH_URL` is a fourth required variable, set in `fly.toml`'s
     `[env]` rather than as a Fly secret: Better Auth derives its cookie and
     trusted-origin rules from it, and cross-origin calls from hub would fail
     its CSRF check without `trustedOrigins`, which is wired to the same
     allowlist. No new human-gated secret.
  2. CORS is hand-rolled rather than `@fastify/cors`, because an app has no
     direct `fastify` dependency by design and auto-installed peers risk two
     fastify instances. `Vary: Origin` is set but tRPC's adapter overwrites it
     on its own responses, so the test pins it on the preflight.
  3. `compose.yml` carries the committed `@hoe/accounts/testing` private key,
     whose private half is public knowledge by design, because the image runs
     under `NODE_ENV=production` and the boot guard would otherwise break
     `docker compose up family`. The Dockerfile now prunes that folder from
     the image.
  4. A duplicate child `username` still surfaces as a 500 rather than a typed
     conflict. Out of scope here and nearly unreachable at household scale;
     worth a line in ticket 06 if the UI wants a friendly message.

- 2026-11-09: **two review fixes applied**, commit `63026b8` (after `0b817f3`,
  which added one test pinning the parent-header strip against any casing).

  1. The committed test key in `compose.yml` is accepted, but now carries a boot
     guard on sprout's `GEO_ENFORCEMENT` model: `loadFamilyEnv` throws if
     `FAMILY_TOKEN_PRIVATE_KEY` matches the `@hoe/accounts/testing` fixture
     while `FLY_APP_NAME` is present. It compares against the imported constant
     (so it cannot drift from the fixture) and ignores whitespace (so a
     rewrapped or `\n`-escaped form of the same key is caught). **This
     supersedes deviation 3 above**: the image no longer prunes
     `packages/accounts/src/testing`, because the guard imports it at runtime,
     and the Dockerfile comment explains why that is safe.
  2. A duplicate child `username` is now a `ConflictError`, mapped from
     SQLSTATE `23505` in the store. Drizzle wraps driver errors, so the code
     sits on `cause` for both `pg` and PGlite; everything else re-raises, pinned
     by a foreign-key-violation test. **This supersedes deviation 4 above.** The
     uniqueness *scope* is deliberately untouched, pending Ed.

  Verified in the real image, not only in unit tests: the stack still boots and
  serves `/health` (so the fixture resolves inside the pruned `node_modules`);
  the same image run with `FLY_APP_NAME` set dies at `main.ts:21` with the
  guard's message, before opening a database connection; and a duplicate
  username over HTTP against real Postgres returns `409 CONFLICT`.

  Verify loop after the fixes: lint and typecheck green, 77 vitest and 3 iwft.
