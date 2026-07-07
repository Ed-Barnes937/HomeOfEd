# 0015 — A route-registration hook on `createAppServer`

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [0004-sprout-migration-plan.md](../plans/0004-sprout-migration-plan.md)
  §5.4 (D9, D3), [0001-foundation.md](0001-foundation.md) (backend-kit as the prod
  server factory), `packages/backend-kit/README.md`

## Context

Every HomeOfEd app boots its production server through `createAppServer` in
`packages/backend-kit` — a Fastify factory that wires the tRPC plugin, a `/health`
check, static assets, and the SPA fallback around an injected `Store`/`BlobStore`.
Until sprout, **all** app data went through tRPC, so the factory needed no
per-app route surface.

sprout needs two HTTP endpoints that are **not** tRPC:

1. **`POST /api/chat/stream`** — token streaming. tRPC's HTTP link is
   request/response; token-by-token SSE (`text/event-stream`) does not fit it, so
   D3 keeps streaming as a plain Fastify route beside tRPC.
2. **`/api/auth/*`** — the Better Auth handler, forwarded through a Fastify route
   (ADR 0012).

Neither can be expressed as a tRPC procedure. The options were: fork
`createAppServer` into a sprout-specific variant (duplicating the tRPC/static/SPA
wiring), drop to raw Fastify for sprout (losing the shared factory), or add a
**small, additive** extension point to the factory.

## Decision

Add an optional route-registration hook to `createAppServer` (D9):

```ts
registerRoutes?: (app: FastifyInstance) => void | Promise<void>
```

It is invoked **after** the tRPC plugin and `/health` are mounted and **before**
the static-asset handler and the SPA catch-all fallback — so app routes are
reachable but do not shadow tRPC or `/health`, and the SPA fallback still catches
everything else. `backend-kit` re-exports the Fastify types the hook needs so apps
do not add a direct Fastify dependency.

The change is **purely additive**: the parameter is optional, existing apps pass
nothing and behave exactly as before. sprout passes a `registerRoutes` that mounts
`chat-sse.ts` (the SSE route) and the Better Auth handler.

**What this hook is not.** It is a seam for a few genuinely non-tRPC transports
(streaming, an OAuth-style handler), not an invitation to build REST APIs beside
tRPC. Hard rule 4 stands: **application data goes through tRPC**, injected `Store`
behind the one context. The hook exists for the transport shapes tRPC cannot
express, and its bodies still resolve identity via the same auth seam and read/write
through the same `Store`.

## Consequences

- sprout reuses the shared factory (tRPC + static + SPA + `/health` + DI) unchanged
  and adds only the two routes it needs — no fork, no raw-Fastify app.
- Every future app that needs a non-tRPC transport (another app's streaming, a
  webhook receiver) has one contract-respecting place to register it, mounted at
  the right point in the middleware order.
- The risk is that the hook becomes a bypass for tRPC/DI discipline. Mitigated by
  scoping it in this ADR and the kit README to non-tRPC transports only, and by the
  route bodies still going through `ctx.auth` and `Store` — the SSE route
  authenticates the child from the signed cookie and persists flags through the
  injected `Store`, it does not reach around the seams.
- `createAppServer`'s contract grew by one optional field; its default behaviour is
  untouched, so no existing app or test changed.
