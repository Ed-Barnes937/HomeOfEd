# @hoe/test-kit

The shared `.iwft` (isolated whole-frontend test) harness: Playwright
**Component Testing** fixtures, the `page.route` → in-browser-backend
trampoline, and the base Page Object Model.

An `.iwft` mounts the real SPA in a browser; its tRPC calls are served by the
**real router over a fresh in-browser PGlite** — no server process, no ports.

## Public API (T1.1 frozen contract)

```ts
// '@hoe/test-kit'
abstract class BasePage {                 // POM base — app page objects extend it
  protected readonly page: Page
  abstract verifyIsShown(): Promise<void>
}

// Node side of the .iwft transport: intercept tRPC HTTP with page.route and
// trampoline each request to the in-page dispatcher (exposeDispatcher).
function routeTrpcToPage(page: Page, endpoint = '/api/trpc'): Promise<void>

// '@hoe/test-kit/ct-config' (Node-only)
function defineIwftConfig(opts: { ctPort: number; overrides?: PlaywrightTestConfig })
//   testMatch **/*.iwft.tsx (Vitest owns *.test.*), PGlite excluded from optimizeDeps

// Frozen for T2.4 (not yet implemented):
type SeedFn = (db: DbClient<unknown>) => Promise<void>
interface MountedApp { page: Page; root: BasePage }
function mountApp(opts?: { seed?: SeedFn; failures?: FailureRule[]; user?: User | null }): MountedApp
```

## Writing an .iwft (current T1.1 shape)

```tsx
import { routeTrpcToPage } from '@hoe/test-kit'
import { test } from '@playwright/experimental-ct-react'

test('…', async ({ mount, page }) => {
  await routeTrpcToPage(page)
  await mount(<IwftApp />) // app harness: exposeDispatcher(createSimulatorDispatch()) + <App/>
  const pom = new HomePagePom(page)
  await pom.verifyIsShown()
})
```

Per-test isolation is free: CT gives each test a fresh page, the harness module
creates a fresh PGlite per page load, migrated at creation.

T2.4 wraps this into the `mountApp` fixture (seed, failure injection, test
user) and adds the skipped `.e2e` config + extension routing.

## Notes

- Pinned exact: `@playwright/experimental-ct-react` (Component Testing is
  experimental). CT currently bundles **vite 6** — the workspace pins vite 6.4.x
  to match; revisit when Playwright moves to vite 7.
- Apps need a `playwright/index.html` + `playwright/index.ts` CT bootstrap and
  a `playwright-ct.config.ts` calling `defineIwftConfig({ ctPort })` (unique
  port per app).
