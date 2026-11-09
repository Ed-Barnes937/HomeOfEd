# 03 - family DB layer: schema, migrations, FamilyStore

**Status:** ready-for-human
**Type:** task
**Spec:** [../spec.md](../spec.md) §4.1, §4.7
Blocked by: 02

The `@hoe/db` layer for `apps/family`, hub pattern verbatim
(`drizzle.config.ts`, `src/server/schema.ts`, committed `migrations/` +
`migrations.ts` glob + `migrate.ts` release command, `freshTestDb` in tests,
PGlite in simulator/iwft, Postgres in prod).

- `familySchema`: `user` / `session` / `account` / `verification` (stock
  Better Auth tables, declared in our schema - Better Auth's own migrator is
  not used; **no** sprout-style legal-attestation columns),
  `child_profiles` (`id`, `parentId` FK -> `user.id` `onDelete: cascade`,
  unique `username`, `displayName`, `createdAt` - no child email, no child
  credentials), `saves` (`appId`, `accountId`, `slotKey`, `blob` text,
  `version` int, `sizeBytes`, timestamps; PK `(appId, accountId, slotKey)`).
- `saves.accountId` carries **no FK** (holds parent or child ids) - document
  this in the schema. Erasure is explicit: `deleteAccount` collects parent id
  + all child profile ids and deletes their `saves` rows and the `user` row
  in **one transaction**.
- `FamilyStore` interface + `DrizzleFamilyStore`; handlers depend on the
  interface only (hard rule 3).

TDD, store-level: transactional erasure leaves **no orphan saves** (this
replaces sprout's FK-cascade guarantee - pin it), cascade of profiles on
user delete, version bump on put, unique username.

## Comments

- 2026-11-09: **built** on branch `family-first-slice` (on top of ticket 02's
  `03c6f8d`), commit `12b5802`.

  **What landed.** hub's DB layer copied verbatim: `drizzle.config.ts`,
  `src/server/schema.ts`, the committed `migrations/` journal
  (`0000_groovy_princess_powerful.sql` + `meta/`), `migrations.ts` (the Vite
  `?raw` glob), `migrate.ts` (logger label `family`), and `store.ts` with the
  `FamilyStore` interface plus `DrizzleFamilyStore`. `@hoe/db`, `drizzle-orm`
  and `drizzle-kit` joined `package.json` with the `generate`/`migrate`
  scripts, and `vitest.config.ts` got hub's PGlite timeout allowance.

  **Invariants, all pinned by tests.** 13 store tests over PGlite with the
  generated migrations: `deleteAccount` erases the parent, its profiles and
  every save row owned by parent *or* child in one transaction and leaves no
  orphans, and leaves another household entirely alone; `child_profiles`
  cascade when the `user` row goes; `version` bumps on every put and per
  `(appId, accountId, slotKey)` slot independently; `username` uniqueness
  holds; `listSaves` returns slot metadata with no blob; `sizeBytes` is the
  blob's byte length (computed with `TextEncoder`, not `Buffer`, because the
  store also runs in the `.iwft` browser bundle).

  **`saves.accountId` carries no FK** - a two-line schema comment says why, and
  the erasure test is what replaces the cascade guarantee. Better Auth's four
  stock tables are declared in our schema with no legal-attestation columns.

  **Ticket 02's three deferred items picked up.** `fly.toml` gained the
  `[deploy] release_command`, compose the `migrate.ts &&` prefix, and `/health`
  is now deep: `main.ts` builds the real Postgres client and closes
  `healthCheck` over `store.ping()`. `healthCheck` is an injected callback on
  `createAppServer`, so this touches nothing else - the router stays
  `createTRPC<void>()` and `simulator.ts`/`IwftApp.tsx` still inject no Store
  until a procedure needs one (ticket 04). Two consequential edits came with
  the release command: the Dockerfile needed `@hoe/db` in the prod-deps
  `--filter` plus its runtime `COPY` (otherwise `migrate.ts` cannot resolve
  `@hoe/db/node` in the image) and PGlite back on the `rm -rf` line, and
  `.env.example` now sets `DATABASE_URL`.

  **Nothing here depends on the hoe-pg-vs-family-pg topology question**; the
  app only ever sees `DATABASE_URL`, and ADR 0070 was left untouched.

  **Verify.** `pnpm lint` and `pnpm typecheck` green across all 19 workspace
  tasks; `pnpm --filter family run test` green (15 vitest, 3 iwft). Docker
  stack verified against the real image: `docker compose up family` logged
  `migrations applied` then `server listening`, `psql` showed the six tables
  with `saves_app_id_account_id_slot_key_pk` and no FK on `account_id`,
  `/health` returned `{"ok":true}` and `/api/trpc/greeting` the handler's
  value.

  **The deep `/health` was proved to be a real round-trip, not a stub:**
  stopping `family-db` under the running image took the app down with it, and
  it served `{"ok":true}` again once the db was back. Observation worth a
  separate ticket, NOT fixed here: losing Postgres **crashes the process**
  rather than yielding `createAppServer`'s 503, because `@hoe/db`'s
  `createDbClient` attaches no `error` listener to the `pg` pool, so an idle
  client's error is unhandled. That is shared by every DB-backed app in the
  estate (hub, wotd, fridge, sprout), not specific to family. On Fly the
  machine simply restarts, which for a scale-to-zero app is survivable.

- 2026-11-09: **reviewed** by a fresh-context agent, verdict sound, and the
  five findings it raised are fixed in `a277601`.

  It checked the committed migration SQL against `schema.ts` field by field,
  and `meta/0000_snapshot.json` against both, finding no drift. That is the
  failure mode which otherwise stays invisible until a deploy. It also
  confirmed the no-FK decision holds in all three places, that `deleteAccount`
  genuinely runs every statement on one `tx`, and that the Better Auth tables
  are sprout's minus the legal-attestation columns and minus every child
  credential field.

  **The one finding that mattered: atomicity was asserted, not pinned.** Both
  erasure tests checked the end state of a *successful* `deleteAccount`, which
  an implementation of two sequential non-transactional deletes would pass
  identically. The transaction wrapper is the whole point of giving up the FK
  cascade, so it now has a test with teeth: a `BEFORE DELETE` trigger on `user`
  that raises, standing in for a future `NO ACTION` reference, with all three
  tables asserted intact after the rollback. Swapping the transaction for the
  bare client was confirmed to fail it.

  Also fixed: `putSave`'s conflict path moved off the Node clock onto
  the database clock so `updatedAt` cannot move backwards while `version` moves
  forwards; `ping()` stopped reading the PII table with `select *`, becoming
  `select 1`, which proves the same liveness without pulling a child's name and
  email into process memory on every 30s poll; and the two stale comments in
  `simulator.ts` and `router.ts` now point at ticket 04 like the rest.

  Reviewer endorsed the four deferrals to tickets 04 and 05. Noted without
  action: no index on `saves(account_id)`, irrelevant at household scale.

  **Final state:** 15 store tests, 17 vitest and 3 iwft green for the app;
  lint and typecheck green repo-wide including a forced uncached run; docker
  stack re-smoked against the real image after the SQL changes.

- 2026-11-09: **username uniqueness narrowed to per household** (owner's answer
  to `for-ed.md` item 4). `child_profiles` now carries
  `child_profiles_parent_username_unique` on `(parent_id, username)` instead of
  a global unique on `username`. Migration 0000 and its snapshot were
  regenerated in place with `drizzle-kit generate`, since nothing real had
  applied them; the file name and journal tag are unchanged. The store test
  became two invariants against PGlite (two households may share a username and
  both rows persist; one household may not, as a typed `CONFLICT`), and the
  `CONFLICT` mapping needed no change because it keys off `23505`. The identity
  handler test and `FakeFamilyClient` follow the same rule.
