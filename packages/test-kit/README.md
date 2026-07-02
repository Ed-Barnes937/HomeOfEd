# @hoe/test-kit

The shared `.iwft` (isolated whole-frontend test) harness: Playwright
**Component Testing** fixtures, the `page.route` → in-browser-backend
trampoline, and the base Page Object Model.

An `.iwft` mounts the real SPA in a browser; its tRPC calls are served by the
**real router over a fresh in-browser PGlite** — no server process, no ports.

## Public API (T1.1 frozen contract)

```ts
// '@hoe/test-kit' (Node side — test files + app fixture files)
abstract class BasePage {                 // POM base — app page objects extend it
  protected readonly page: Page
  abstract verifyIsShown(): Promise<void>
}
type SeedFn = (db: DbClient<DbSchema>) => Promise<void>
interface MountedApp { page: Page; root: BasePage }
function mountApp(opts?: { seed?: SeedFn; failures?: FailureRule[]; user?: User | null }): Promise<MountedApp>
//   provided as a CT fixture by createIwftTest (below); call once per test

function createIwftTest<Root extends BasePage>(def: {
  harness: JSX.Element                    // the app's <IwftApp /> — created in APP code
  createRoot: (page: Page) => Root        // becomes MountedApp.root
  endpoint?: string                       // default '/api/trpc'
})                                        // → CT `test` extended with the mountApp fixture

function routeTrpcToPage(page: Page, endpoint = '/api/trpc'): Promise<void>  // bare trampoline
function installTrpcRoute(page: Page, opts?: TrpcRouteOptions): Promise<void> // trampoline + failures/user

// '@hoe/test-kit/browser' (in-page side — imported by the app's harness module)
function applyPendingSeed<S>(db: DbClient<S>): Promise<DbClient<S>>
function testUserAuth(req: Request): AuthProvider

// '@hoe/test-kit/ct-config' (Node-only)
function defineIwftConfig(opts: { ctPort: number; overrides?: PlaywrightTestConfig })

// '@hoe/test-kit/e2e-config' (Node-only, currently inert — see below)
function defineE2eConfig(opts?: { overrides?: PlaywrightTestConfig })
```

Note: the contract was frozen as `SeedFn = (db: DbClient<unknown>) => …`;
`DbClient`'s type parameter is constrained to `DbSchema`, so the implemented
type is `DbClient<DbSchema>` — same intent (a schema-agnostic client), the
narrowest compiling spelling.

## Writing an `.iwft` with `mountApp`

An app registers its specifics **in its own code** (test-kit never imports an
app). Two small files, then tests stay thin:

```tsx
// apps/<app>/src/testing/iwftTest.tsx — the fixture registration.
// The <IwftApp /> element MUST be created in app code (a .tsx the test file
// imports) so Playwright CT registers the component for the browser bundle.
import { createIwftTest } from '@hoe/test-kit'
import { HomePagePom } from './HomePagePom.ts'
import { IwftApp } from './IwftApp.tsx'

export const test = createIwftTest({
  harness: <IwftApp />,
  createRoot: (page) => new HomePagePom(page),
})
```

```tsx
// apps/<app>/src/testing/IwftApp.tsx — the in-page harness. It wires the real
// backend itself (rather than reusing the dev simulator factory) because the
// seed/auth seams need the DbClient handle and the auth dep:
import { applyPendingSeed, testUserAuth } from '@hoe/test-kit/browser'

exposeDispatcher(
  (async () => {
    const db = await applyPendingSeed(await freshTestDb(appSchema, migrations))
    return createDispatcher({
      router: appRouter,
      createContext: createContext({ store: new RealStore(db), blobs, logger, auth: testUserAuth }),
    })
  })(),
)
export function IwftApp() { return <App /> }
```

```tsx
// apps/<app>/src/*.iwft.tsx — the tests
import { test } from './testing/iwftTest.tsx'

test('renders', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
})
```

**POM conventions:** page objects extend `BasePage`, live in the app's
`src/testing/`, and expose intent-level `verify*`/action methods — `.iwft`
tests contain no raw locators or `expect`s. Keep `.iwft` thin: pin behaviour
volume in the fast Vitest layer; reserve `.iwft` for whole-page behaviour.

## Per-test isolation (fresh PGlite)

Free, by construction: CT gives every test a **fresh page**, and the harness
module creates + migrates a **new PGlite at module init** on each page load
(module load happens at `mount`). No reset hooks; keep it true by never caching
the db across pages.

## The three `mountApp` seams

**Seed** — `mountApp({ seed })` runs the SeedFn against the test DbClient
*before the app's first query*. Mechanism: the fixture stashes
`seed.toString()` on the page (`window.__hoeSeedSource`) before mounting; the
harness's `applyPendingSeed(db)` picks it up between migration and dispatcher
creation. Constraints (it crosses the Node→browser boundary as **source
text**): the function must be **self-contained** — no closures over test
scope, no imports; the `db` parameter is all it gets, so use raw SQL via
`db.execute("…")`.

**Failures** — `mountApp({ failures })` applies frozen `FailureRule`s
**Node-side at the trampoline**, so nothing from the backend is involved. The
tRPC procedure path is matched from the request URL (batched paths are
comma-split). `error` → fulfil with a tRPC-shaped `INTERNAL_SERVER_ERROR`
(HTTP 500); `latency` → delay `ms`, then dispatch normally; `network` →
`route.abort()`. Granularity is per **request**: if any procedure in a batch
matches, the whole batch request gets the failure. (Expect React Query's
default 3 retries before a UI error state settles — give error assertions a
generous timeout.)

**Test user** — `mountApp({ user })` sends the well-known header
`x-hoe-test-user: <id>` (`TEST_USER_HEADER`) on every trampolined request; the
harness passes `testUserAuth` as the `auth` dep of `createContext`, which reads
the header back into `ctx.auth`. No header (or `user: null/undefined`) =
anonymous, matching production's default.

## `.e2e` config — defined, inert

`defineE2eConfig` is a standard `@playwright/test` config for future
real-browser E2E (`**/*.e2e.{ts,tsx}` only). **No `.e2e` tests exist and no
app instantiates the config yet** — it exists so the extension is reserved and
the runners can never overlap. Wire it up (per app: a `playwright-e2e.config.ts`
calling it) only when an app's critical flows justify real E2E (ADR 0001 §13).

## Extension routing

| Extension | Runner | Config |
|---|---|---|
| `*.test.ts(x)` | Vitest | each package's `vitest.config.ts` (`include: src/**/*.test.{ts,tsx}`) |
| `*.iwft.tsx` | Playwright CT | `defineIwftConfig` (`testMatch: '**/*.iwft.tsx'`) |
| `*.e2e.ts(x)` | Playwright (inert) | `defineE2eConfig` (`testMatch: '**/*.e2e.{ts,tsx}'`) |

Each runner's match pattern excludes the others' files by construction; pinned
by `src/extensionRouting.test.ts`.

## Notes

- Pinned exact: `@playwright/experimental-ct-react` (Component Testing is
  experimental). CT currently bundles **vite 6** — the workspace pins vite 6.4.x
  to match; revisit when Playwright moves to vite 7.
- Apps need a `playwright/index.html` + `playwright/index.ts` CT bootstrap and
  a `playwright-ct.config.ts` calling `defineIwftConfig({ ctPort })` (unique
  port per app).
- `@hoe/test-kit/browser` is the only entry safe to import from code that ends
  up in the CT browser bundle; the other entries import Playwright (Node-only).
