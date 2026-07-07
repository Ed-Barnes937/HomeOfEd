import {
  DISPATCHER_WINDOW_KEY,
  type FailureRule,
  type User,
  type WireDispatch,
  type WireRequest,
} from '@hoe/backend-kit'
import type { Page } from '@playwright/test'

import { injectedFailureResponse, matchFailureRule } from './failures.ts'
import { testUserHeaders } from './protocol.ts'

export interface TrpcRouteOptions {
  endpoint?: string
  /** Applied Node-side, before the request reaches the in-page dispatcher. */
  failures?: FailureRule[]
  /** Sent as the well-known test-user header on every trampolined request. */
  user?: User | null
}

/**
 * Node side of the .iwft transport: intercept the app's tRPC HTTP calls with
 * page.route and trampoline each request into the page, where the app harness
 * has exposed the real router over in-browser PGlite (exposeDispatcher).
 * Failure rules short-circuit at this layer; the test user rides along as a
 * header for the harness's auth seam.
 */
export async function installTrpcRoute(page: Page, opts: TrpcRouteOptions = {}): Promise<void> {
  const endpoint = opts.endpoint ?? '/api/trpc'
  await page.route(`**${endpoint}/**`, async (route) => {
    const req = route.request()
    const url = req.url()

    const rule = matchFailureRule(url, endpoint, opts.failures ?? [])
    if (rule?.mode === 'network') {
      return route.abort('failed')
    }
    if (rule?.mode === 'error') {
      const { status, contentType, body } = injectedFailureResponse(url, endpoint)
      return route.fulfill({ status, contentType, body })
    }
    if (rule?.mode === 'latency') {
      await new Promise((resolve) => setTimeout(resolve, rule.ms ?? 0))
    }

    const wire: WireRequest = {
      method: req.method(),
      url,
      headers: { ...(await req.allHeaders()), ...testUserHeaders(opts.user ?? null) },
      body: req.postData() ?? undefined,
    }
    const res = await page.evaluate(
      async ({ wire, key }) => {
        const dispatch = (window as unknown as Record<string, unknown>)[key] as WireDispatch
        return dispatch(wire)
      },
      { wire, key: DISPATCHER_WINDOW_KEY },
    )
    // The dispatch is async; if the page navigated away or the test ended (its
    // teardown unroutes) while we were awaiting it, the route is already
    // resolved and fulfilling again throws. That's a moot request, not a test
    // failure — swallow only those teardown/navigation races.
    try {
      await route.fulfill({ status: res.status, headers: res.headers, body: res.body })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!/already handled|closed|Target page/i.test(msg)) throw err
    }
  })
}

/** T1.1-frozen signature — the plain trampoline with no failures/user. */
export async function routeTrpcToPage(page: Page, endpoint = '/api/trpc'): Promise<void> {
  return installTrpcRoute(page, { endpoint })
}
