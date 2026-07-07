# apps/sprout

The child-safe LLM web app, being migrated into the hub per
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).

**Current phase: P4 done (frontend SPA).** P0–P3 (scaffold, DB, auth, tRPC
backend) plus the Vite SPA are in: `main.tsx`→`App.tsx`→`router.tsx` (TanStack
Router, no Start), the tRPC client (`trpcClient.ts`), `features/*` query/mutation
factories, and the real parent + child screens under `pages/` with presentational
`components/`. The greeting scaffold is removed (procedure + handler + demo).

**P4 decisions / carry-overs:**
- **Styling is P7.** Ported components keep the source's Tailwind class strings
  verbatim; `components/ui/*` are minimal plain-markup primitives (Button, Card,
  Input, Label, Slider, Switch, Textarea) preserving the import surface. No SCSS
  modules, no `@base-ui`/`cva` — that conversion is the P7 workstream.
- **Parent auth gate is a tRPC probe.** `features/parentAuth` gates parent
  screens by probing `children.list` (throws UNAUTHORIZED when not a parent) —
  there is no `me` procedure (no new backend surface in P4). The Better Auth
  client (`parentAuth.signIn/signUp/signOut` → `/api/auth/*`) is wired but the
  prod mount is **P5/D9**, so parent login/register/sign-out and the parent's
  display name are not round-trippable yet.
- **Chat streaming is P5.** The chat pages port structure only; `features/chat/
  useChat.ts` `sendMessage` is a `TODO(P5)` stub (no SSE reader), and the child's
  own guardrail config isn't loaded client-side (needs the P5 child-scoped path).
- **Client-facing domain constants** (`PRESET_DEFINITIONS`, `CALIBRATION_QUESTIONS`,
  types) are imported from `server/domain/*` (pure, browser-safe) until the
  P6 `packages/sprout-shared` extraction.

**`.iwft` auth seam:** the harness header carries only `user.id`, so role rides
inside an encoded id — `testing/users.ts` `asParent(id)`/`asChild(id, parentId)`,
decoded by `IwftApp.tsx`. Seed UUIDs must be valid v4 (zod `.uuid()` rejects
arbitrary hex); seeds are self-contained (no closures over module scope).

Landing here in a later phase: SSE streaming (P5), the pipeline (P6), and SCSS
styling (P7) are not built yet.

## Layout

```
src/
  server/
    schema.ts       all 13 tables (app + Better Auth); exports sproutSchema + SproutSchema
    store.ts        SproutStore interface + DrizzleSproutStore over DbClient<SproutSchema>
    migrations/     committed drizzle-kit output (*.sql + meta/_journal.json)
    migrations.ts   Vite ?raw glob loader (browser/vitest)
    migrate.ts      release_command entrypoint (migratePostgres)
    handlers/       Handler classes — business logic, AppContext<SproutStore>
    router.ts       tRPC router; createTRPC<SproutStore>(); exports AppRouter
    simulator.ts    dev/.iwft backend wiring: real router + Node-side PGlite Store
    main.ts         prod entrypoint: createAppServer + deep /health (store.ping())
    store.test.ts   Vitest — DrizzleSproutStore over PGlite (incl. §6.7 feature checks)
  main.tsx App.tsx router.tsx  SPA entry (createRoot → QueryClient → RouterProvider)
  trpcClient.ts     createTRPCClient<AppRouter> over httpBatchLink('/api/trpc')
  features/*        query-option + mutation factories over trpcClient (per group)
  pages/*           the parent + child screens (TanStack Router route components)
  components/       presentational components + ui/* primitives (Tailwind-for-now; P7)
  lib/*             client-side helpers (childSession, deviceToken, chatConfig, cn)
  testing/          IwftApp harness + iwft fixture + SproutAppPom + users encoders
  *.iwft.tsx        whole-frontend flows (parent-*, child-flows); chat flows are P5
drizzle.config.ts   drizzle-kit config (schema -> migrations)
vite.config.ts      react + simulatorPlugin (dev simulator mode)
playwright-ct.config.ts  defineIwftConfig({ ctPort: 3105 })
```

Note: the source schema has **no true `jsonb` columns** — `flags.topics` is
`text` holding a JSON string and presets are plain `integer` sliders; ported
faithfully. FKs `children.parentId`/`devices.parentId` -> `user.id` are
`onDelete: cascade` for clean account-erasure semantics.

## Commands

- `pnpm dev --filter=sprout` — simulator mode on port **3004** (real router, no
  persistence; restart to pick up server changes).
- `pnpm test --filter=sprout` — Vitest (`*.test.ts`) then Playwright CT (`*.iwft.tsx`).
- Prod (container): `pnpm build` then `pnpm start` (default port 8080).

## Rules

- Server code changes go through TDD: unit test against the injected seams first,
  `.iwft` only for whole-page behaviour (keep it thin).
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3004, CT 3105.
