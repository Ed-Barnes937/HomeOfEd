# @hoe/backend-kit

The layered-backend kit: the DI seam every app builds on, plus the
backendSimulator transports. Same handlers in production and in tests; only the
injected persistence changes.

```
transport      tRPC (fetch adapter) — Vite middleware · in-browser dispatch · createAppServer (Fastify)
   ↓
domain         Handler classes — depend on AppContext (interfaces) only
   ↓
persistence    Store (app-defined) + BlobStore
```

Subpaths: `@hoe/backend-kit` (browser-safe core), `./simulator` and `./server`
(Node-only — never import from browser code), `./testing` (test-only).

## Public API (T1.1 frozen contract)

```ts
interface Logger { debug/info/warn/error(m, fields?); child(bindings): Logger }
// ConsoleLogger = throwaway stand-in until @hoe/logger (T2.3)

interface BlobStore {
  put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}
class InMemoryBlobStore implements BlobStore // minimal fake; hardened in T2.2. Real Tigris impl deferred.

type User = { id: string }                   // extensible per app via intersection
interface AppContext<Store> {                // the single tRPC context — the DI seam
  store: Store
  blobs: BlobStore
  auth: { getUser(): User | null }           // auth seam — hub injects anonymous
  now(): Date                                // clock seam — tests pin time
  logger: Logger
}

abstract class Handler<Input, Output, Store> {
  abstract run(input: Input, ctx: AppContext<Store>): Promise<Output>
}

// Store-injection seam: singletons in → tRPC's PER-REQUEST context factory out.
// auth derives from the request (defaults to anonymous); now defaults to real time.
function createContext<Store>(deps: {
  store: Store; blobs: BlobStore; logger: Logger
  now?: () => Date
  auth?: (req: Request) => { getUser(): User | null }
}): (req: Request) => AppContext<Store>

// Per-app tRPC instance bound to AppContext<Store>.
// allowOutsideOfServer is set: the .iwft harness runs the router in-browser (spike-validated).
function createTRPC<Store>(): /* initTRPC.context<AppContext<Store>>().create(...) */

// The dispatch seam shared by all transports
type Dispatch = (req: Request) => Promise<Response>
function createDispatcher(opts: {
  router: AnyTRPCRouter
  createContext: (req: Request) => AppContext<unknown>  // type-erasure at the transport boundary
  endpoint?: string                                     // default '/api/trpc'
}): Dispatch

// Browser side of .iwft: register a wire-level dispatcher on window for the
// test-kit's page.route trampoline. Accepts a promise (async PGlite setup).
function exposeDispatcher(dispatch: Dispatch | Promise<Dispatch>): void
interface WireRequest  { method; url; headers; body? }   // serialisable across
interface WireResponse { status; headers; body }         // the Node↔browser boundary

type FailureRule = { path: string; mode: 'error' | 'latency' | 'network'; ms?: number }
// test-only failure-injection tRPC link — signature frozen here, implemented T2.2

// '@hoe/backend-kit/simulator' (Node-only subpath — never in browser bundles)
function simulatorPlugin(opts: { createDispatch: () => Promise<Dispatch>; endpoint?: string }): Plugin

// Prod transport — signature frozen T1.1, BUILT IN T2.2 (Fastify):
function createAppServer(opts: {
  router: AppRouter
  createContext: (req: Request) => AppContext<unknown>
  staticDir: string
  logger: Logger
  healthCheck: () => Promise<{ ok: true }>   // deep /health — app closes over its own Store
}): { listen(port: number): Promise<void> }
```

## Additions beyond the frozen contract (T2.2)

Additive only — nothing frozen changed shape.

```ts
// root export — the domain error taxonomy (see table below)
class DomainError extends TRPCError {}   // abstract base
class ValidationError / UnauthorizedError / ForbiddenError / NotFoundError / ConflictError

// InMemoryBlobStore: fake-only introspection (not on the BlobStore interface)
contentTypeOf(key: string): string | null

// '@hoe/backend-kit/server' (Node-only subpath — never in browser bundles)
function buildAppServer(opts): Promise<FastifyInstance>  // createAppServer's core; tests drive it with fastify.inject()
// createAppServer's returned object also carries close(): Promise<void> (tests / graceful shutdown)

// '@hoe/backend-kit/testing' (test-only subpath — never in prod bundles)
function failureLink(rules: readonly FailureRule[]): TRPCLink<AnyTRPCRouter>
```

## Handler authoring

Handlers are the domain layer: classes extending `Handler<Input, Output, Store>`
that depend on `AppContext<Store>` (interfaces) only — never a concrete DB or
blob impl. The same handler instance logic runs in prod, dev simulator, and
`.iwft`.

```ts
class GetNoteHandler extends Handler<number, Note, NotesStore> {
  async run(input: number, ctx: AppContext<NotesStore>): Promise<Note> {
    const note = await ctx.store.byId(input)
    if (!note) throw new NotFoundError(`note ${input} not found`)
    return note
  }
}
```

Rules of thumb:

- **Throw domain errors** (taxonomy below), never raw `TRPCError` or ad-hoc
  `Error`s for expected failures. Anything else that escapes becomes an opaque
  500.
- Use `ctx.now()` for time and `ctx.auth.getUser()` for identity — both are
  injected seams that tests pin.
- Unit-test handlers with a hand-written Store fake (see
  `src/handlerParity.test.ts` for the pattern proving real-vs-fake parity).

## DI: `createContext` is the whole container

There is deliberately **no DI framework**. `createContext(deps)` closes over
the app's singletons (`store`, `blobs`, `logger`, optional `now`/`auth`) and
returns tRPC's per-request context factory. Swapping prod ↔ simulator is
swapping which `deps` you pass — nothing else changes.

```ts
const ctx = createContext({ store: new DrizzleNotesStore(db), blobs, logger })
// prod:      createAppServer({ router, createContext: ctx, ... })
// dev:       simulatorPlugin({ createDispatch: async () => createDispatcher({ router, createContext: ctx }) })
// .iwft:     exposeDispatcher(createDispatcher({ router, createContext: ctx }))
```

## tRPC helpers + error taxonomy

`createTRPC<Store>()` returns the per-app tRPC instance bound to
`AppContext<Store>` (with `allowOutsideOfServer` for the in-browser `.iwft`
transport). Wire procedures thinly to handlers:

```ts
const t = createTRPC<NotesStore>()
export const appRouter = t.router({
  getNote: t.procedure.input(parseNumber).query(({ input, ctx }) => new GetNoteHandler().run(input, ctx)),
})
```

**Error taxonomy** — handlers throw these; every transport translates them
identically (each class carries its tRPC code, and all tRPC adapters derive
the HTTP status from that code). Pinned in `src/errors.test.ts` and at the
Fastify transport in `src/server/createAppServer.test.ts`.

| Domain error        | tRPC code               | HTTP |
| ------------------- | ----------------------- | ---- |
| `ValidationError`   | `BAD_REQUEST`           | 400  |
| `UnauthorizedError` | `UNAUTHORIZED`          | 401  |
| `ForbiddenError`    | `FORBIDDEN`             | 403  |
| `NotFoundError`     | `NOT_FOUND`             | 404  |
| `ConflictError`     | `CONFLICT`              | 409  |
| anything else       | `INTERNAL_SERVER_ERROR` | 500  |

## `createAppServer` (prod, Fastify)

One container per app: `@fastify/static` serves `staticDir` with an SPA
fallback (unknown non-API GET/HEAD → `index.html`; API paths and non-GETs 404
properly), the tRPC Fastify adapter mounts the router at `/api/trpc`, and
`GET /health` awaits the injected `healthCheck` — 200 `{ ok: true }` on
success, 503 `{ ok: false }` on throw. The app closes `healthCheck` over its
own real `Store` so `/health` is a genuine DB round-trip.

```ts
import { createAppServer } from '@hoe/backend-kit/server'

createAppServer({
  router: appRouter,
  createContext: createContext({ store, blobs, logger }),
  staticDir: path.resolve(import.meta.dirname, '../dist'), // absolute
  logger,
  healthCheck: () => store.ping(),
}).listen(3000)
```

Node-only: import it from `@hoe/backend-kit/server` **only** in the server
entrypoint, never from code Vite bundles.

## The three transports, one router

1. **Dev simulator** — `simulatorPlugin` mounts the dispatcher on the Vite dev
   server (Node-side PGlite). Backend changes need a dev-server restart.
2. **.iwft** — the app harness calls `exposeDispatcher(createSimulatorDispatch())`
   in the CT browser bundle (PGlite-WASM); `@hoe/test-kit` trampolines
   `page.route` → `window` dispatcher.
3. **Prod** — `createAppServer` serves the SPA bundle + the same router.

All three are pinned against one fixture router in `src/transports.test.ts`
(dispatcher + Vite middleware) and `src/server/createAppServer.test.ts`
(Fastify).

## Failure injection (`@hoe/backend-kit/testing`)

`failureLink(rules)` is a test-only `@trpc/client` link implementing the
frozen `FailureRule` shape, matched by procedure path:

- `error` — the call fails with a `TRPCClientError` (no request is made).
- `latency` — wait `ms`, then pass through unchanged.
- `network` — fail like a dead network: `TRPCClientError` caused by a
  fetch-style `TypeError`, no response `data`.

```ts
createTRPCClient<AppRouter>({
  links: [failureLink([{ path: 'getNote', mode: 'error' }]), httpLink({ url: '/api/trpc' })],
})
```

Test code only (the `./testing` subpath keeps it out of prod bundles);
`@hoe/test-kit`'s `mountApp({ failures })` is the `.iwft`-facing surface.

## Deferred (docs-only, on purpose)

- **REST adapter** — not built until an app genuinely fits REST better than
  tRPC. Add it as another thin transport over the same handlers then.
- **Tigris BlobStore** — the real impl waits for the first app that stores a
  blob (`hub` does not). The frozen `BlobStore` interface is the seam; the
  in-memory fake is the only impl today.
- **WebSockets** — `@fastify/websocket` is the escalation path when an app
  needs WS (ADR 0001 §3: separate Fly app). Not wired into `createAppServer`.

## Testing

`pnpm test --filter=@hoe/backend-kit` — the kit's own Vitest suite: blob fake
semantics (`src/blobs.test.ts`), error taxonomy (`src/errors.test.ts`),
real-vs-fake handler parity (`src/handlerParity.test.ts`), all three
transports (`src/transports.test.ts`, `src/server/createAppServer.test.ts`),
and the failure link (`src/testing/failureLink.test.ts`). Fixture app in
`src/testSupport/fixtureApp.ts`. Handler/context behaviour is additionally
pinned by app-level suites (see `apps/hub/src/server/health.test.ts`).
