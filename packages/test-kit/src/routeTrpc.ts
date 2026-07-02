import { DISPATCHER_WINDOW_KEY, type WireDispatch, type WireRequest } from '@hoe/backend-kit'
import type { Page } from '@playwright/test'

/**
 * Node side of the .iwft transport: intercept the app's tRPC HTTP calls with
 * page.route and trampoline each request into the page, where the app harness
 * has exposed the real router over in-browser PGlite (exposeDispatcher).
 */
export async function routeTrpcToPage(page: Page, endpoint = '/api/trpc'): Promise<void> {
  await page.route(`**${endpoint}/**`, async (route) => {
    const req = route.request()
    const wire: WireRequest = {
      method: req.method(),
      url: req.url(),
      headers: await req.allHeaders(),
      body: req.postData() ?? undefined,
    }
    const res = await page.evaluate(
      async ({ wire, key }) => {
        const dispatch = (window as unknown as Record<string, unknown>)[key] as WireDispatch
        return dispatch(wire)
      },
      { wire, key: DISPATCHER_WINDOW_KEY },
    )
    await route.fulfill({ status: res.status, headers: res.headers, body: res.body })
  })
}
