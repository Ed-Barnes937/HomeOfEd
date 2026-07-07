# apps/sprout

The child-safe LLM web app, migrated into the hub per
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).
The build (P0–P10) is complete; go-live (P11) is human-gated — see
[`docs/go-live.md`](docs/go-live.md). Sibling: [`apps/sprout-pipeline`](../sprout-pipeline)
is the headless safety service this app calls.

It is a Vite SPA (`main.tsx`→`App.tsx`→`router.tsx`, TanStack Router, no Start —
[D6](../../docs/adr/0003-spa-default-tanstack-start-opt-in.md)) over a tRPC client
(`trpcClient.ts`), with `features/*` query/mutation factories and the parent +
child screens under `pages/`. Styling is SCSS modules (`*.module.scss` +
`styles/tokens.scss`; the `components/ui/*` primitives are plain markup, no
Tailwind, no `cva`).

**How the moving parts fit:**
- **Chat SSE route** (`server/chat-sse.ts`): a plain `text/event-stream` Fastify
  route `POST /api/chat/stream`, mounted via the backend-kit `registerRoutes` hook
  ([ADR 0015](../../docs/adr/0015-createappserver-route-hook.md), D9). It
  authenticates the child from the signed cookie (never the body, #34/#35), loads
  guardrail config server-side by the authenticated `childId` (#36), calls the
  pipeline over an **injected `PipelineClient` seam**, streams tokens, and
  **persists `flag` events to the DB** as they arrive. Child + AI MESSAGES are
  persisted client-side via tRPC (`conversations.saveMessage`).
- **PipelineClient seam** (`server/pipeline/pipelineClient.ts`): interface +
  `createHttpPipelineClient` (real Node fetch to `hoe-sprout-pipeline.flycast`
  with `x-pipeline-key`) + `createHttpSummariser`. The private-network call is
  exercised end-to-end in docker-stack / at deploy.
- **Two identities behind one `ctx.auth` seam**
  ([ADR 0012](../../docs/adr/0012-sprout-app-owned-auth.md)): parent (Better Auth
  cookie session; `/api/auth/*` forwarded through Fastify, an `onRequest` hook
  stamps a server-trusted `x-sprout-parent` header — any inbound value stripped
  first) and child (a signed `sprout_child_session` token). The `authSeam` picks
  the provider per request; handlers derive identity only from `ctx.auth`.
- **Child-session cookie:** the HMAC-signed token minted at child login is set
  CLIENT-side as the same-origin `sprout_child_session` cookie
  (`lib/childSession.setChildSessionCookie`) — not httpOnly (an SPA can't set that
  and the frozen tRPC context seam can't reach the response), but tampering is
  caught by the server-side HMAC check (#34).
- **`children.myConfig`**: a child-scoped tRPC read of the child's OWN sliders +
  calibration (`requireChild`), powering the chat session-limit banner / intent
  gate. Shares `loadChildConfig` with parent-scoped `children.config` and the SSE
  route (#36).
- **`useChat`**: the buffered SSE reader (`lib/sseFrames.readSseStream` →
  `lib/chatStream.streamChat`); partial `data:` frames buffer across
  `reader.read()` boundaries so no tokens drop (`lib/sseFrames.test.ts`), and an
  `AbortController` cancels on unmount.
- **Retention worker** (`server/worker.ts`,
  [ADR 0014](../../docs/adr/0014-worker-process-scheduled-work.md), D8): a
  `setInterval` loop around a pure `runRetentionSweep(deps)` over the same `Store`,
  run as the Fly `worker` process group from the same image. Prunes conversations +
  behavioural events past their retention windows (`RETENTION_DAYS` /
  `BEHAVIOURAL_EVENT_RETENTION_DAYS` / `WORKER_INTERVAL_MS`).
- **Parent auth gate is a tRPC probe.** `features/parentAuth` gates parent screens
  by probing `children.list` (throws UNAUTHORIZED when not a parent) — there is no
  `me` procedure.
- **Client-facing domain constants** (`PRESET_DEFINITIONS`, `CALIBRATION_QUESTIONS`,
  `PresetName`/`PresetSliders`/`CalibrationAnswer`) come from `@hoe/sprout-shared`
  (also consumed by `apps/sprout-pipeline`). `server/domain/presets.ts` keeps only
  `SLIDER_KEYS`, the sprout-only server-side slider allow-list.

**`.iwft` auth seam:** the harness header carries only `user.id`, so role rides
inside an encoded id — `testing/users.ts` `asParent(id)`/`asChild(id, parentId)`,
decoded by `IwftApp.tsx`. Seed UUIDs must be valid v4 (zod `.uuid()` rejects
arbitrary hex); seeds are self-contained (no closures over module scope).

**Product-legal / safeguarding.** This app carries a child-safeguarding posture
that gates *release* (not merge): the [safeguarding runbook](docs/safeguarding/csam-grooming-escalation.md),
the [launch-readiness gate](docs/launch-readiness.md), and the product's own
[legal/guardrail ADRs](docs/product-legal-adrs.md). An agent must not tick the
counsel/legal items in those docs.

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
