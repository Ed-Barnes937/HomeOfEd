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
  `03c6f8d`), commit `d7c4da5`.

  **What landed.** hub's DB layer copied verbatim: `drizzle.config.ts`,
  `src/server/schema.ts`, the committed `migrations/` journal
  (`0000_groovy_princess_powerful.sql` + `meta/`), `migrations.ts` (the Vite
  `?raw` glob), `migrate.ts` (logger label `family`), and `store.ts` with the
  `FamilyStore` interface plus `DrizzleFamilyStore`. `@hoe/db`, `drizzle-orm`
  and `drizzle-kit` joined `package.json` with the `generate`/`migrate`
  scripts, and `vitest.config.ts` got hub's PGlite timeout allowance.

  **Invariants, all pinned by tests.** 12 store tests over PGlite with the
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
