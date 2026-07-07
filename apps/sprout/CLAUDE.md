# apps/sprout

The child-safe LLM web app, being migrated into the hub per
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).

**Current phase: P5 done (streaming).** P0–P4 (scaffold, DB, auth, tRPC backend,
Vite SPA) plus the first streaming transport are in. `main.tsx`→`App.tsx`→
`router.tsx` (TanStack Router, no Start), the tRPC client (`trpcClient.ts`),
`features/*` factories, and the real parent + child screens under `pages/`.

**P5 additions (streaming + the two P2/P4 carry-overs):**
- **Chat SSE route** (`server/chat-sse.ts`): a plain `text/event-stream` Fastify
  route `POST /api/chat/stream`, mounted via the new backend-kit `registerRoutes`
  hook (D9). It authenticates the child from the signed cookie (never the body,
  #34/#35), loads guardrail config server-side by the authenticated `childId`
  (#36), calls the pipeline over an **injected `PipelineClient` seam**, streams
  tokens, and **persists `flag` events to the DB** as they arrive. The child + AI
  MESSAGES are still persisted client-side via tRPC (`conversations.saveMessage`).
- **PipelineClient seam** (`server/pipeline/pipelineClient.ts`): interface +
  `createHttpPipelineClient` (real Node fetch to `hoe-sprout-pipeline.flycast`
  with `x-pipeline-key`) + `createHttpSummariser`. The real pipeline app is P6;
  this is only the sprout side that calls it — exercised end-to-end at P6/deploy.
- **`/api/auth/*` mounted** (`main.ts`, discharges the P2 TODO): Better Auth's
  handler is forwarded through a Fastify route; an `onRequest` hook resolves the
  Better Auth cookie session per tRPC request and stamps a **server-trusted**
  `x-sprout-parent` header (any inbound value is stripped first) that the one
  `authSeam` reads to pick `fixedAuthProvider(parent)` vs the child provider.
  Parent login/register/sign-out are now round-trippable in prod/docker.
- **Child-session cookie:** the signed token minted at child login is set
  CLIENT-side as the same-origin `sprout_child_session` cookie
  (`lib/childSession.setChildSessionCookie`) — not httpOnly (an SPA can't set
  that and the frozen tRPC context seam can't reach the response), but tampering
  is caught by the server-side HMAC check, which is what #34 required.
- **`children.myConfig`**: a child-scoped tRPC read of the child's OWN sliders +
  calibration (`requireChild`), powering the chat client's session-limit banner /
  intent gate. Shares `loadChildConfig` with the parent-scoped `children.config`
  and the SSE route (#36).
- **`useChat` completed:** the buffered SSE reader (`lib/sseFrames.readSseStream`
  → `lib/chatStream.streamChat`) drives the transcript; **the frame-boundary bug
  is fixed** (partial `data:` frames buffer across `reader.read()` boundaries, so
  no dropped tokens — see `lib/sseFrames.test.ts`), and an `AbortController`
  cancels the stream on unmount.

**P4 decisions / carry-overs:**
- **Styling is P7.** Ported components keep the source's Tailwind class strings
  verbatim; `components/ui/*` are minimal plain-markup primitives (Button, Card,
  Input, Label, Slider, Switch, Textarea) preserving the import surface. No SCSS
  modules, no `@base-ui`/`cva` — that conversion is the P7 workstream.
- **Parent auth gate is a tRPC probe.** `features/parentAuth` gates parent
  screens by probing `children.list` (throws UNAUTHORIZED when not a parent) —
  there is no `me` procedure. The Better Auth mount + parent-session resolution
  landed in P5, so parent login/register/sign-out now round-trip.
- **Client-facing domain constants** (`PRESET_DEFINITIONS`, `CALIBRATION_QUESTIONS`,
  `PresetName`/`PresetSliders`/`CalibrationAnswer` types) now come from
  `@hoe/sprout-shared` (the P6a extraction — also consumed by
  `apps/sprout-pipeline`). `server/domain/presets.ts` keeps only `SLIDER_KEYS`,
  the server-side slider-key allow-list, which is sprout-only and never
  crosses into the pipeline.

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
- **Chat is dual-transport in `.iwft`.** Everything on the chat page goes through
  the real router over PGlite (child-authenticated via the `mountApp({ user })`
  header), EXCEPT `POST /api/chat/stream`, which is not tRPC so the PGlite
  trampoline never serves it. Script it with the `page.route` SSE simulator
  (`testing/chatSse.installChatStreamRoute`, the sanctioned fallback). Flag
  PERSISTENCE (server-side) is proven separately in `server/chat-sse.test.ts`
  (the real route + Store over `createAppServer`), not in `.iwft` — the simulated
  route doesn't hit the Store. The frame-buffer fix is unit-tested directly in
  `lib/sseFrames.test.ts`.
- Relative imports carry explicit `.ts`/`.tsx` extensions; server code sticks to
  erasable TS syntax (ADR 0004) — `simulator.ts`/`main.ts` run under native Node.
- Ports: dev 3004, CT 3105.
