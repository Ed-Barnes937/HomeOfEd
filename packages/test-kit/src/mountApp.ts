// The mountApp CT fixture, produced per app by createIwftTest. Node-side.
import { test as ctBase } from '@playwright/experimental-ct-react'
import type { Page } from '@playwright/test'
import type { JSX } from 'react'

import type { BasePage } from './pom.ts'
import { SEED_SOURCE_KEY } from './protocol.ts'
import { installTrpcRoute } from './routeTrpc.ts'
import type { MountAppOpts, MountedApp } from './types.ts'

/** mountApp as tests receive it (root narrowed to the app's own root POM). */
export type MountApp<Root extends BasePage = BasePage> = (
  opts?: MountAppOpts,
) => Promise<MountedApp & { root: Root }>

export interface IwftAppDefinition<Root extends BasePage> {
  /**
   * The app's .iwft harness element (e.g. `<IwftApp />`), created in the
   * app's OWN .tsx fixture file so Playwright CT registers the component.
   * The harness module must expose the in-page dispatcher + seed/auth seams
   * (exposeDispatcher / applyPendingSeed / testUserAuth).
   */
  harness: JSX.Element
  /** Root page object handed back as MountedApp.root. */
  createRoot: (page: Page) => Root
  /** tRPC mount path. Default: '/api/trpc'. */
  endpoint?: string
}

/**
 * Extend Playwright CT's `test` with the app's mountApp fixture. Usage
 * (in the app's own testing code — apps register their specifics here,
 * test-kit never imports an app):
 *
 *   export const test = createIwftTest({
 *     harness: <IwftApp />,
 *     createRoot: (page) => new HomePagePom(page),
 *   })
 *
 * Call mountApp once per test. Fresh-PGlite-per-test is inherent: CT gives
 * every test a fresh page, and the harness module creates (and migrates) a
 * new PGlite at module init on each page load.
 */
export function createIwftTest<Root extends BasePage>(def: IwftAppDefinition<Root>) {
  return ctBase.extend<{ mountApp: MountApp<Root> }>({
    mountApp: async ({ mount, page }, use) => {
      await use(async (opts: MountAppOpts = {}) => {
        if (opts.seed) {
          // Ship the SeedFn across the Node→browser boundary as source text;
          // the harness runs it (applyPendingSeed) before its first query.
          await page.evaluate(
            ({ key, source }) => {
              ;(globalThis as unknown as Record<string, unknown>)[key] = source
            },
            { key: SEED_SOURCE_KEY, source: opts.seed.toString() },
          )
        }
        await installTrpcRoute(page, {
          endpoint: def.endpoint,
          failures: opts.failures,
          user: opts.user ?? null,
        })
        await mount(def.harness)
        return { page, root: def.createRoot(page) }
      })
      // Teardown: a request the app fired near the end of the test can still be
      // trampolining when the page closes, surfacing a "Test ended" route-handler
      // error unrelated to the assertions. Drain in-flight route handlers and
      // ignore their teardown errors (Playwright's recommended pattern).
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    },
  })
}
