import type { AnyTRPCRouter } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

import type { AppContext } from './context.ts'

/** A captured tRPC HTTP request → real router → Response. */
export type Dispatch = (req: Request) => Promise<Response>

/**
 * Serialisable request/response shapes for crossing the Playwright
 * Node ↔ browser boundary (page.route handler → in-page dispatcher).
 */
export interface WireRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}
export interface WireResponse {
  status: number
  headers: Record<string, string>
  body: string
}

export type WireDispatch = (wire: WireRequest) => Promise<WireResponse>

/**
 * The dispatch seam all transports share: wrap an app's router + per-request
 * context factory into a `Request → Response` function. Used by the Vite dev
 * middleware (Node-side PGlite), the in-browser .iwft dispatcher
 * (PGlite-WASM), and — semantically — the prod server's tRPC adapter.
 */
export function createDispatcher(opts: {
  router: AnyTRPCRouter
  createContext: (req: Request) => AppContext<unknown>
  /** Mount path of the tRPC API. Default: '/api/trpc'. */
  endpoint?: string
}): Dispatch {
  const endpoint = opts.endpoint ?? '/api/trpc'
  return (req) =>
    fetchRequestHandler({
      endpoint,
      req,
      router: opts.router,
      createContext: ({ req }) => opts.createContext(req),
    })
}

const WINDOW_KEY = '__hoeDispatch'

/**
 * Browser side of the .iwft transport: register a wire-level dispatcher on
 * `window` for the test-kit's page.route handler to call via page.evaluate.
 * Accepts a promise so the app harness can expose it before async setup
 * (PGlite creation + migration) finishes — calls await readiness.
 */
export function exposeDispatcher(dispatch: Dispatch | Promise<Dispatch>): void {
  const wireDispatch: WireDispatch = async (wire) => {
    const resolved = await dispatch
    const response = await resolved(
      new Request(wire.url, {
        method: wire.method,
        headers: wire.headers,
        body: wire.body,
      }),
    )
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    }
  }
  ;(globalThis as Record<string, unknown>)[WINDOW_KEY] = wireDispatch
}

/** Shared with @hoe/test-kit so both sides agree on the window key. */
export const DISPATCHER_WINDOW_KEY = WINDOW_KEY
