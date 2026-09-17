# 01 - Inventory: accounts and save data today

**Status:** resolved
**Type:** research
**Map:** ../map.md

## Question

What exactly exists today that a global account layer must build on or around?
Verify in the code - don't trust ticket summaries.

- **sprout accounts:** how are parent/child accounts modelled, authed, and
  stored (schema, session/auth mechanism, Store interfaces, where passwords or
  secrets live)? Could they plausibly be leveraged or extracted, or are they
  sprout-shaped?
- **ADR 0008 seams:** what did it decide, and what seams were deliberately left
  for a future central identity service (e.g. wotd's `ctx.auth` null seam - see
  `apps/wotd/CLAUDE.md`)? Which other apps have such seams?
- **Save-data inventory:** which apps persist what, where (localStorage keys vs
  server-side DB), and roughly how big per user. Known: boop `boop:save`
  (localStorage, ADR 0025), silt scenes + field notes (localStorage), espy
  doodles (localStorage), karesansui, orbi. Check every app in `apps/`.
- **Constraints:** restate the hard rules that bound any design (leaf-node
  apps, no cross-app imports, shared code as packages, Store/BlobStore
  interfaces, all data through tRPC).

Deliverable: the inventory, appended as the Answer.

## Answer

### 1. sprout accounts

**Schema** (`apps/sprout/src/server/schema.ts` - one merged schema, 13 tables, one migration journal):

- Better Auth tables: `user` (schema.ts:32 - id, email unique, `subscriptionStatus`, plus two sprout-legal columns `ukResidenceAttestedAt`/`tosAgreedAt`, both NOT NULL), `session` (:47 - token, expiry, ip/UA, FK user cascade), `account` (:60 - provider credentials incl. `password` hash column, Better Auth owns it), `verification` (:78).
- App tables: `children` (:89 - `parentId` FK -> `user.id` onDelete cascade, `username` unique, `passwordHash`, `pinHash`, `mustChangePassword`, `presetName`), `presets` (:107, 7 integer sliders per child), `devices` (:125 - `parentId` FK, unique `deviceToken`), `calibrationAnswers` (:136), `conversations` (:146, soft-delete `deletedAt`), `messages` (:161), `flags` (:172), `parentSeededTopics` (:190), `behaviouralEvents` (:204 - append-only rate/lockout log, pruned by retention).
- The parent->child FK cascade was added in the migration precisely for clean account erasure (schema.ts:18-22, ADR 0012 consequences).

**Auth mechanism** - two identities behind the single `ctx.auth` seam (ADR 0012, `docs/adr/0012-sprout-app-owned-auth.md`):

- **Parent**: Better Auth email+password cookie session (`apps/sprout/src/server/auth/betterAuth.ts` - `betterAuth()` at :36, `drizzleAdapter` at :58, `emailAndPassword` at :62, legal-gate `additionalFields` at :66 and a `databaseHooks.user.create.before` reject/stamp hook at :84). `/api/auth/*` is forwarded through Fastify; an `onRequest` hook resolves the session and stamps a server-trusted `x-sprout-parent` header (inbound values stripped first). Registration is closed behind `REGISTRATION_INVITE_CODE`, required in prod (`apps/sprout/src/server/main.ts:61-63`, sprout ADR-0019).
- **Child**: an HMAC-SHA256-signed, self-contained token (`apps/sprout/src/server/auth/childToken.ts` - mint at :51, verify at :74, 30-day TTL at :31, dedicated `CHILD_SESSION_SECRET` distinct from `BETTER_AUTH_SECRET`). Carried in a same-origin `sprout_child_session` cookie set client-side (not httpOnly; tamper caught server-side - `apps/sprout/src/lib/childSession.ts:19`). Verification needs no DB round-trip. Children log in with username+password (scrypt via `apps/sprout/src/server/password.ts:11`, injected through a `PasswordHasher` port to keep node:crypto out of the browser bundle) or a PIN on a registered device (`devices.deviceToken`, stored client-side in localStorage `sprout-device-token`, `apps/sprout/src/lib/deviceToken.ts:4`). PIN brute-force lockout rides `behaviouralEvents`.
- **Provider selection**: `apps/sprout/src/server/auth/providers.ts` - `ChildUser`/`ParentUser` extend backend-kit's `User = { id }` by intersection (:18-20); `childAuthProvider` (:59) is synchronous and drops into `createContext`'s `auth?: (req) => AuthProvider` seam; `resolveParentUser` (:78) is the async Better Auth half, wrapped with `fixedAuthProvider` (:50).
- **Authorization**: handlers never read identity from input. `requireParent` (`apps/sprout/src/server/handlers/authz.ts:24`), `requireChild` (:33), `verifyChildOwnership` (:47 - the cross-family IDOR guard), `verifyConversationOwnership` all derive identity from `ctx.auth` only.

**Store interface**: `SproutStore` (`apps/sprout/src/server/store.ts:85`) is one wide app-owned interface - health ping, parent-account rows (`createUser`/`deleteUser`, :94-96 - "Better Auth owns the write path in prod; these support tests + the FK anchor + account erasure"), children CRUD, presets, calibration, devices, topics, conversations (soft delete, summarise+purge, retention listing), messages, flags, behavioural events. Implemented once by `DrizzleSproutStore` over `DbClient<SproutSchema>`; PGlite in dev/tests, Postgres in prod.

**Verdict (facts + observations)**: The parts split cleanly along a line the code already draws. The *mechanisms* are generic: Better Auth's four tables (`user`/`session`/`account`/`verification`) are stock Better Auth apart from the two sprout-legal timestamp columns; the signed-token pattern, the `AuthProvider`-per-request selection, and the `require*`/ownership-check idioms are all expressed against backend-kit's frozen `ctx.auth` seam and would port to any app. The *model* is sprout-shaped: the two-role parent/child union, `parentId`-carrying child claims, PIN-on-registered-device login, `mustChangePassword`, behavioural lockouts, and the NOT NULL legal-attestation columns on `user` are all child-safeguarding product decisions, and everything hangs off sprout's single merged schema and single `SproutStore` (account rows and app rows in one migration journal, FK-coupled for erasure). ADR 0012 explicitly records this as a bounded V1 divergence: "when central auth arrives, it becomes a third AuthProvider (or replaces the two); handlers, which only ever see `ctx.auth`, do not change. The seam is the migration path" - and equally that sprout owning the `user` tables and `CHILD_SESSION_SECRET` is "a V1 posture, recorded so it is a decision and not drift".

### 2. ADR 0008 seams

**What ADR 0008 decided** (`docs/adr/0008-apps-without-a-database.md`): stateless is the baseline app shape; a DB is opt-in. Crucially for accounts (:33-37): "**Auth is orthogonal to persistence.** ... auth will be **decentralised** - a central identity service issuing tokens that apps verify through the already-frozen `ctx.auth.getUser()` seam (ADR 0001 §4), not each app running its own user table." No-DB apps keep the injected seams "frozen and present" (:51-55): anonymous apps inject a null auth provider; an authed route later plugs a central-auth provider into the *same* seam, no DB involved. The design of that service (token format, which routes are gated) is an explicitly deferred future ADR (:106-109).

**The seam itself** lives in backend-kit, shared by every app:

- `packages/backend-kit/src/context.ts:5` - `User = { id: string }` ("extensible per app via intersection"); `:7-9` - `AuthProvider { getUser(): User | null }`; `:18` - `auth: AuthProvider` on `AppContext`; `:29` - the injection point `auth?: (req: Request) => AuthProvider` on `CreateContextDeps`; `:32` - the default `anonymous` provider (`getUser: () => null`).

**Where the null seam sits today, per app**:

- **wotd**: auth deliberately dropped for v1; "`ctx.auth` stays the null seam and returns when the central identity service exists (ADR 0008)" - `apps/wotd/CLAUDE.md:45-46`. No `auth` injected anywhere in `apps/wotd/src/server`.
- **templates/starter** (the copy base): `GreetingHandler` reads `ctx.auth.getUser()` and greets the user by id or falls back to anonymous (`templates/starter/src/server/handlers/greetingHandler.ts:20`); the test exercises both branches (`greeting.test.ts:25,32-33`). Every starter-derived app inherits this.
- **boop** and **silt**: verbatim copies of that greeting handler/tests (`apps/silt/src/server/handlers/greetingHandler.ts:20`, `apps/boop/src/server/greeting.test.ts:32`).
- **hub, boids, fridge, karesansui, espy**: no auth provider injected; their handler tests pass `auth: { getUser: () => null }` explicitly (e.g. `apps/hub/src/server/health.test.ts:19`, `apps/espy/src/server/health.test.ts:8` - "exercises the auth seam even though the handler ignores it").
- **sprout**: the only app with real providers plugged into the seam (section 1; ADR 0012 names the seam as the future central-auth migration path).
- **sprout-pipeline**: no user auth at all - service-to-service `x-pipeline-key` shared secret over the Fly private network (`apps/sprout-pipeline/CLAUDE.md:16,42`); not a `ctx.auth` consumer.

So: one seam, defined once, present in all ten apps; null everywhere except sprout; no other app has any bespoke auth machinery.

### 3. Save-data inventory

Backend split (verified against `apps/*/fly.toml` release_command, `@hoe/db` in `apps/*/package.json`, and `compose.yml` DB services): **DB-backed** = hub, wotd, fridge, sprout (each has `release_command = 'node src/server/migrate.ts'`, `@hoe/db`, and its own `*-db` Postgres 17 service in compose). **Stateless** = boids, boop, espy, karesansui, silt, sprout-pipeline (fly.toml explicitly notes no release_command). There is no `apps/orbi` on this branch.

| App | Persists what | Where | Rough size per user | Backend/DB? |
|---|---|---|---|---|
| hub | colour theme only | localStorage `theme` (`apps/hub/src/pages/useColourTheme.ts:5`) | bytes | Real DB (health table only, `apps/hub/src/server/schema.ts:3` - the worked example; deploy-record labels are a committed repo file, ADR 0036/0047) |
| boids | sim settings (theme/shape) | localStorage `boids:settings:v1` (`apps/boids/src/features/sim/settings.ts:23`) | bytes | No DB (older `InMemoryStatusStore` idiom, ADR 0008 "Reconciling boids") |
| fridge | personal board (magnets); shared boards | localStorage `fridge:v1` (`apps/fridge/src/features/board/serialize.ts:8`); DB `shared_boards` (`apps/fridge/src/server/schema.ts:11` - immutable anonymous jsonb snapshots, 10-char base62 id, ADR 0010) | board JSON, a few KB; one row per published share | Real DB |
| wotd | UI theme only (user side); daily words (shared, not per-user) | localStorage `wotd-theme` (`apps/wotd/src/features/theme/theme.ts:7`); DB `words` table (`apps/wotd/src/server/schema.ts:12`, unique (for_date, difficulty)) | bytes per user; 4 word rows/day globally | Real DB |
| espy | doodles: vector ops + at most one baked field raster (undo-history rasters stripped, quota-retry) | localStorage `espy:doodle:v2` (`apps/espy/src/features/doodle/session.ts:16,99-122`) | KBs typical; a baked raster data-URL can push it to low MBs (quota-retry logic exists) | No DB (stateless, ADR 0008) |
| karesansui | garden presets | localStorage `karesansui:presets:v2` (+ legacy `v1` migration) (`apps/karesansui/src/features/garden/settings.ts:11-12`) | small JSON, KBs | No DB |
| boop | whole save document: autosaved working grid + "My boops" + songs, one key, version inside (ADR 0025/0032, key frozen) | localStorage `boop:save` (`apps/boop/src/persistence/storage.ts:21`) | ~couple hundred bytes per boop (ADR 0025:52); a few KB total. Share links are URL-encoded (ADR 0026), no server | No DB |
| silt | saved scenes (index + per-scene byte blobs + thumbnails), field-notes discovery progress, first-visit hint | localStorage `silt:scenes` index, `silt:scene:<id>`, `silt:thumb:<id>` (`apps/silt/src/features/scenes/sceneStore.ts:32-34`); `silt:fieldNotes` (`fieldNotesStore.ts:26`); `silt:seen` (`HomePage.tsx:26`) | ~240KB worst case per scene, ~20 scenes fills a 5MB quota (ADR 0029); thumbs 300x200 PNG; fieldNotes small JSON | No DB |
| sprout | ALL family data server-side: parent accounts + sessions, children (password/PIN hashes), presets, calibration, devices, conversations, messages, safety flags, seeded topics, behavioural events. Client-side only: device token + child UI profile | Postgres `sprout` DB (13 tables, section 1); localStorage `sprout-device-token` (`lib/deviceToken.ts:4`), `sprout-child-session` (UI profile, NOT the credential - `lib/childSession.ts:1-8`) | chat text dominates; bounded by the retention worker (summarise+purge of conversations, global behavioural-event sweep - `server/worker.ts`) | Real DB |
| sprout-pipeline | nothing ("owns no persistent state", `apps/sprout-pipeline/CLAUDE.md:36`) | - | - | No DB (headless service, ADR 0013) |

Cross-cutting: no app stores per-user data server-side keyed to an identity except sprout. Fridge's `shared_boards` and wotd's `words` are anonymous/shared rows. Every per-user artefact outside sprout lives in localStorage on one device.

### 4. Constraints on any account-layer design

From root `CLAUDE.md` hard rules + ADR 0001:

1. **Leaf-node apps** (rule 1; ADR 0001 §2 :40-45): apps may import `packages/*`; no app imports another app; shared code goes in a package. Enforced by convention + review.
2. **No shared UI** (rule 2): packages are plumbing only. An account layer cannot ship shared login components; each app owns its UI.
3. **Layered backend + DI everywhere** (rule 3; ADR 0001 §4): transport (tRPC) -> domain handlers -> `Store`/`BlobStore` interfaces; handlers depend on interfaces, never concrete impls; same handlers run in prod and simulator. The tRPC context carries the frozen seams `ctx.now()` and `ctx.auth.getUser()` (ADR 0001 §4 :107).
4. **All data through tRPC, never server functions** (rule 4; ADR 0001 §4 :100-105): one DI path; the Store rides the single tRPC context.
5. **Fakes over mocks** (rule 5; ADR 0001 §5): PGlite/in-memory fakes behind interfaces; the simulator and `.iwft` reuse the real router.
6. **One container per app, one Fly app + subdomain per app** (ADR 0001 §3, §9); each app owns its own schema, queries, and Store impl (§7 :172); its own database in the shared `hoe-pg` cluster (§6).
7. **Stateless is the baseline; DB opt-in; auth does not imply a DB** (ADR 0008) - a central identity layer must be consumable by no-DB apps through `ctx.auth` alone.
8. **Infrastructure is human-gated** (root CLAUDE.md): fly/Cloudflare mutations are handed to the human with the runbook.

Directly identity/save-data-relevant ADR decisions:

- **ADR 0008** (repo): decentralised identity service is the recorded direction; the `ctx.auth` seam is the integration point; the service's design is an open future ADR.
- **ADR 0012** (repo): sprout's Better Auth ownership is a bounded V1 divergence; the swap path is a new `AuthProvider` behind the same seam; sprout currently owns account storage and `CHILD_SESSION_SECRET`.
- **sprout ADR-0019** (`apps/sprout/docs/product-legal-adrs.md:768`, Accepted 2026-08-26): supervised family pilot ahead of counsel sign-off; registration closed behind server-checked `REGISTRATION_INVITE_CODE` (required in prod, boot-crash if missing - `main.ts:61-63`). **Status: the legal gate is deferred, not closed** - `apps/sprout/docs/launch-readiness.md:11-17` records the pilot note; opening registration beyond the household "is the release the gate protects" and re-blocks on the full gate (counsel sign-off, named safeguarding people, real ToS/Privacy text). Any account layer that touches sprout registration or shares sprout identities is inside this gate's blast radius.
- **ADR 0010** (fridge shared boards): the one existing anonymous-server-data pattern - immutable snapshots, no identity.
- **ADR 0025/0032** (boop) and **ADR 0029** (silt): localStorage save formats are versioned-inside-the-value with frozen keys and explicit quota handling - the shapes any server-side save sync would have to ingest.
- **ADR 0013/0014**: headless service app shape and worker-process scheduled work exist as precedents (sprout-pipeline; sprout retention worker) if an identity service or sync pruner needs either shape.

### Facts most relevant to the options papers

1. Exactly one app (sprout) has accounts; its auth is deliberately app-owned V1 with the swap path pre-recorded: a new `AuthProvider` behind the frozen `ctx.auth` seam (ADR 0012).
2. The seam is already universal: `AuthProvider { getUser(): User | null }` in `packages/backend-kit/src/context.ts:7`, defaulting to anonymous (:32), present and tested in all ten apps; `User = { id }` is extensible by intersection.
3. ADR 0008 already commits to the direction "central identity service issuing tokens that apps verify through `ctx.auth`", explicitly not per-app user tables - and leaves the service design as an open ADR.
4. sprout's child token proves the verify-without-a-DB pattern in-repo: self-contained HMAC claims, secret-only verification (`childToken.ts`).
5. Outside sprout, all per-user data is localStorage on one device: boop `boop:save` (KBs), silt scenes (~240KB/scene, up to ~5MB), espy `espy:doodle:v2` (KBs-MBs), karesansui `karesansui:presets:v2`, fridge `fridge:v1`, boids settings, three theme keys - so "account" today would mostly mean sync/backup of small-to-mid JSON blobs plus silt's chunky byte blobs.
6. Only 4 of 10 apps have a DB at all (hub, wotd, fridge, sprout); hub's is a health-table worked example; none but sprout keys server rows to a user.
7. Hard rules force any shared account machinery into a new `packages/*` (plumbing only, no shared UI), consumed per-app through tRPC contexts, with each app keeping its own leaf-node schema/Store.
8. sprout's legal gate (ADR-0019) is open: registration is invite-code-closed to one household; anything coupling other apps' identities to sprout's user table inherits that gate.
