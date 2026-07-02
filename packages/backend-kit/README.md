# @hoe/backend-kit

The layered-backend kit: the DI seam every app builds on, plus the
backendSimulator transports. Same handlers in production and in tests; only the
injected persistence changes.

```
transport      tRPC (fetch adapter) — Vite middleware · in-browser dispatch · createAppServer (T2.2)
   ↓
domain         Handler classes — depend on AppContext (interfaces) only
   ↓
persistence    Store (app-defined) + BlobStore
```

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

## The three transports, one router

1. **Dev simulator** — `simulatorPlugin` mounts the dispatcher on the Vite dev
   server (Node-side PGlite). Backend changes need a dev-server restart.
2. **.iwft** — the app harness calls `exposeDispatcher(createSimulatorDispatch())`
   in the CT browser bundle (PGlite-WASM); `@hoe/test-kit` trampolines
   `page.route` → `window` dispatcher.
3. **Prod** — `createAppServer` (T2.2) serves the SPA bundle + the same router.

## Testing

Handler/context behaviour is pinned by app-level Vitest suites (see
`apps/hub/src/server/health.test.ts`); the transports are proven by hub's dev
mode and `.iwft`. T2.2 adds the kit's own suite.
