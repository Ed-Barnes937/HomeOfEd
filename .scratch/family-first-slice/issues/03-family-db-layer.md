# 03 - family DB layer: schema, migrations, FamilyStore

**Status:** ready-for-agent
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
