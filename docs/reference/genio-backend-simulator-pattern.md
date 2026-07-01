# Reference: the Genio backend-simulator + IWFT pattern

A factual write-up of how the `genio/frontend` codebase (studied via the
`planner` app + shared `common` package) does dependency injection, fakes, the
backend simulator, and isolated whole-frontend tests (IWFT). Captured to inform
the App Hub foundation plan. **This describes Genio as-is; it is not yet a
decision for App Hub** — see "Deltas for App Hub" at the end.

## Architecture context (important)

Genio frontends are **Vite React SPAs talking to a separate backend service**
over HTTP (axios) at `/<app>/api`. The backend is **not** in this repo. So the
"backend simulator" is a **frontend-owned in-memory fake of the backend's HTTP
contract** — not the production backend code running against a fake database.
Fidelity comes from **shared TypeScript types + JSON-schema request validation**,
and from the fakes being faithful in-memory implementations reused everywhere
(not ad-hoc per-test responses).

Stack seen in `planner`: Vite 8, React, `@tanstack/react-query`, axios HTTP
client, Vitest (unit), `@playwright/experimental-ct-react` (IWFT — component
testing), `@playwright/test` (E2E). No tRPC, no Drizzle, no PGlite.

## Two fake seams

There are **two distinct injection points**, used by two different test layers:

| Seam | What's faked | Used by | Real impl | Fake impl |
|---|---|---|---|---|
| **API class** | the typed client method | Vitest unit/component | `HttpNotebookApi` | `FakeNotebookApi` |
| **Backend simulator** | the whole network/API | IWFT + dev "simulator mode" | the real app's HTTP stack | in-memory route handlers + DB, served via `page.route` (tests) or Vite middleware (dev) |

### Seam 1 — API classes (Vitest)

Each feature defines an **interface + HTTP impl + fake impl**:

```ts
// NotebookApi.ts
export interface NotebookApi {
  getNotebooks: () => Promise<Result<GetNotebooksResponse>>
  saveNotebook: (id: NotebookId, req: SaveNotebookRequest) => Promise<Result<Notebook>>
}
export class HttpNotebookApi implements NotebookApi {       // real
  constructor(private httpClient: HttpClient) {}
  getNotebooks = () => this.httpClient.call({ name, call: http => http.get('/notebooks'), responseSchema })
  // ...
}
export const notebookApi = new HttpNotebookApi(plannerHttpClient)   // prod singleton
```

```ts
// FakeNotebookApi.testHelper.ts — in-memory, implements the same interface
export class FakeNotebookApi implements NotebookApi {
  saveShouldFail = false
  constructor(public notebooks: Notebook[] = []) {}
  getNotebooks = async () => success({ notebooks: this.notebooks })
  saveNotebook = async (id, req) => { /* upsert in memory; or makeUnexpectedError() */ }
}
```

**Injection is plain function-argument DI** — queries/mutations take the api:

```ts
// saveNotebookMutation.test.tsx
const fakeApi = new FakeNotebookApi()
await saveNotebookMutationOptions(fakeApi).mutationFn({ notebookId, request })
expect(fakeApi.notebooks).toHaveLength(1)
```

The fake exposes test affordances (`saveShouldFail`, public `notebooks`). This
layer never touches a browser or network — fast, for logic/query/mutation tests.

### Seam 2 — the backend simulator (IWFT + dev simulator mode)

The simulator is built from three reusable pieces:

**(a) A shared `Route` abstraction** (`common/src/playwright-common/Route.testHelper.ts`):
`get/put/post/patch/deleteMethod` helpers producing `Route { method, urlPattern,
handler, requestBodySchema? }`. A handler receives a typed `HttpRequest`
(`pathParams`, `queryParams`, `headers`, `body`, `url`) and returns a value
(JSON) or an `HttpResponse`. URL patterns like `/task/:taskId` compile to regex
with named groups. Request bodies are validated against an **ajv JSON schema**.
Failure modes are first-class via `EndpointBehaviour` (`DEFAULT | ERROR | STALL |
NETWORK_ERROR`) and `handleEndpointBehaviour(...)`.

**(b) Route-handler classes (DI over an in-memory DB)**
(`planner/src/playwright/iwft/network/`):

```ts
export abstract class RouteHandlers {
  constructor(protected readonly db: BackendSimulatorDb) {}   // DB injected
  abstract getRoutes(): Route<any, any>[]
}
export class TasksRouterHandlers extends RouteHandlers {
  getRoutes = () => [
    get('/tasks', req => handleEndpointBehaviour(
      this.db.endpointBehaviourManager.getBehaviour(EndpointKey.GET_TASKS),
      () => ({ tasks: filterByNotebookId(this.db.taskList, req.queryParams.notebookId) }))),
    // put/patch/delete ... all mutate this.db
  ]
}
```

`BackendSimulatorDb` is the in-memory store: arrays (`taskList`, `notebookList`,
…), a `profile`, captured `logRecords`, per-endpoint call counts, and an
`EndpointBehaviourManager`. `ROUTE_HANDLER_CLASSES` lists all handler classes;
they're instantiated as `new HandlerClass(db).getRoutes()`.

**(c) Two transports over the same routes + DB:**

- **IWFT (browser, Playwright):** `connectRoutes(page, { prefix: '/planner/api' },
  routes)` calls `page.route('/planner/api/**', …)` and fulfils each request by
  running the matching handler and `route.fulfill({ json })` (or `route.abort()`
  for `NETWORK_ERROR`, hang for `STALL`). The **real app + real `HttpNotebookApi`
  + real axios** run; only the network is intercepted.
- **Dev "simulator mode" (Node):** `createSimulatorMiddleware({ apiPrefix, routes })`
  is a Connect middleware mounted on the Vite dev server via a plugin
  (`configureServer` → `server.middlewares.use`). Same routes + a fresh
  `BackendSimulatorDb`, served through a Node HTTP adapter. This lets the whole
  app run locally in a browser with **no real backend**.

So `page.route` interception **is** used for IWFT — and that's fine. The
principle is *fakes, not mocks*: the handlers are a faithful, reused in-memory
backend, not per-test canned responses. `page.route` is just the browser-side
transport.

## How an IWFT test is wired

**Runner:** `playwright-ct.config.ts` (`@playwright/experimental-ct-react`),
`testDir: src/playwright/iwft`, `testMatch: **/*.iwft.{ts,tsx}`, served on
`ctPort: 3100` with a Vite config (react + svgr + scss). E2E is a separate
`playwright.config.ts` (`*.e2e.ts`) against a real running app; screenshots reuse
the CT config with `*.screenshot.ts`.

**Fixture** (`iwft/support/fixture.testHelper.ts`) extends the CT `test` with:
- `backendSimulator` — a fresh `BackendSimulator` per test.
- `launcher` — a `Launcher(mount, page, backendSimulator, displayConfig)`.
- page-object fixtures (e.g. `notebooksPage`) that launch + return a POM.
- an auto fixture that attaches the simulator's captured logs to the test report.

**Launch sequence** (`launchApp.testHelper.tsx`):
1. `backendSimulator.handleNetworking(page)` → installs `page.route` interception.
2. `page.clock.install({ time: CURRENT_TIME })` → deterministic time.
3. `mount(<IwftApp initialRoute={…} />)` → CT mounts the **real** `App`
   (lazy-imported) wrapped in `Prenavigate` (sets the route) + `Suspense`.
4. Returns a `TestContext { page, backendSimulator }`; a **Page Object** is built
   from it and `verifyIsShown()`-ed.

**Page Objects** live in `src/playwright/pageObjects/**/*PageObject.testHelper.ts`
(e.g. `NotebooksPageObject`, `NotebookEditPageObject`). Tests drive the UI only
through POM methods (`clickNextNotebook`, `fillName`, `expectNameError`, …).

**A test reads as seed → launch → act → assert:**

```ts
test('Renaming the notebook auto-saves on blur', async ({ backendSimulator, launcher }) => {
  backendSimulator.notebooks.addNotebook(makeNotebook({ name: 'Biology 101', colour: BLUE }))
  const notebooksPage = await launcher.launchExpectingNotebooksPage()
  await notebooksPage.clickNextNotebook()
  const editPage = await (await notebooksPage.openCardMenu(), notebooksPage.clickEditMenuItem())
  await editPage.fillName('Chemistry 201'); await editPage.blurName()
  await notebooksPage.verifyOnlyNotebookInBackend('persisted', n => expect(n.name).toBe('Chemistry 201'))
  await backendSimulator.verifyAnalyticsEmitted(a => a.planner.notebooks /* … */)
})
```

The `BackendSimulator` test API: seed (`tasks/notebooks/deadlines.addX`,
`setProfile`), inspect (`getAll`, `getCallCount`, `verifyOnlyTask`), inject
failures (`simulateEndpointError/Stalled/Default`), and assert analytics
(`verifyAnalyticsEmitted`). Tests assert **against the in-memory DB**, not the
network — e.g. "empty name shows error AND `getCallCount(SAVE_NOTEBOOK) === 0`".

## Key files (relative to `genio/frontend`)

| Path | Role |
|---|---|
| `common/src/playwright-common/Route.testHelper.ts` | `Route` model, verb helpers, `connectRoutes` (page.route), `EndpointBehaviour`, schema validation |
| `common/src/simulatorMode/createSimulatorMiddleware.ts` | Connect middleware over the same routes (dev mode) |
| `common/src/simulatorMode/simulatorServerSetup.ts`, `nodeHttpAdapter.ts` | Node HTTP wiring + session-cookie injection |
| `planner/simulatorMode/simulatorVitePlugin.ts` | Vite plugin: mounts the middleware on the dev server |
| `planner/src/simulatorMode/simulatorMiddleware.ts` | App-specific: `new BackendSimulatorDb()` + `ROUTE_HANDLER_CLASSES` |
| `planner/src/playwright/iwft/network/BackendSimulatorDb.testHelper.ts` | In-memory DB + `ROUTE_HANDLER_CLASSES` |
| `planner/src/playwright/iwft/network/routeHandlers/*` | Per-domain route handlers (DI over the DB) |
| `planner/src/playwright/iwft/network/BackendSimulator.testHelper.ts` | Test-facing wrapper: seeding, behaviour injection, assertions |
| `planner/src/playwright/iwft/support/{fixture,Launcher,launchApp,IwftApp}.testHelper.*` | CT fixture, launch sequence, real-App mount |
| `planner/src/playwright/pageObjects/**` | Page Object Models |
| `planner/src/features/*/api/{XApi.ts,FakeXApi.testHelper.ts}` | API-class seam (interface + Http + Fake) |
| `planner/playwright-ct.config.ts`, `playwright.config.ts` | IWFT/screenshot vs E2E runners |

## Conventions worth noting

- Test-only files use the **`.testHelper.ts(x)`** suffix; IWFT specs use
  **`.iwft.ts(x)`**, E2E **`.e2e.ts(x)`**, screenshots **`.screenshot.ts`**.
- Shared **factories** (`makeNotebook`, `plannerProfileFactory`) build domain
  objects for both seeding and assertions.
- Determinism: fixed clock, fixed locale/timezone (`en-GB`/`Europe/London`),
  injected session cookies/localStorage.
- The simulator captures emitted analytics/log records so tests assert on them.

## Deltas for App Hub (open — for the re-review, not decided here)

App Hub's planned stack differs from Genio in ways that change how this pattern
maps:

> **Resolved (ADR 0003):** App Hub now **defaults to a Vite SPA** (TanStack
> Router + Query), making it much closer to Genio than the original TanStack
> Start assumption. IWFT uses **Playwright CT + `page.route`** — but dispatches to
> the **real tRPC router over in-browser PGlite** (not reimplemented handlers).
> Delta 1 below is therefore largely mooted for default apps; it applies only to
> apps that opt into TanStack Start.

1. **TanStack Start (SSR + server fns), not a Vite SPA.** Genio mounts a pure
   client `App` via Playwright CT. With SSR + server functions, "mount the app in
   CT" and "intercept `/api` with `page.route`" need re-validation — server-side
   data loading doesn't go through browser `fetch`. *(Now an opt-in-only concern
   per ADR 0003.)*
2. **Same-monorepo TypeScript backend (tRPC).** Genio's simulator re-implements a
   *separate* backend's HTTP contract. App Hub could instead reuse real handlers,
   or follow Genio and keep a frontend-owned fake. This is the core decision the
   re-review must settle — and it determines whether PGlite/Drizzle belong in the
   picture at all (Genio uses neither on the frontend).
3. **`page.route` is acceptable** (correcting the earlier ADR wording): mocks
   aren't forbidden — **fakes are preferred**. The Genio pattern uses `page.route`
   purely as transport in front of faithful, reused in-memory handlers.
4. **Two seams, not one.** Genio gets fast logic tests from API-class fakes
   (Vitest) *and* whole-frontend tests from the simulator (IWFT). App Hub's plan
   currently conflates these.

## Improvement proposals for App Hub (for the re-review, not decided)

App Hub can do this materially better than Genio because Genio's core constraint
— the backend is a separate service in a separate repo — does not apply to us.
Genio's route-handler classes, hand-written in-memory DB, Playwright Component
Testing, and `page.route` interception are all workarounds for that constraint.

### Main idea — reuse the real backend instead of faking its contract

- The real tRPC router lives **in the same monorepo**. The simulator should
  **mount the real router with a fake persistence layer injected**, not
  re-implement endpoints. This deletes Genio's `Route` / `EndpointKey` /
  `RouteHandlers` / `BackendSimulatorDb` scaffolding and the two-implementations
  drift risk.
- The fake DB should be **PGlite (real SQL via the same Drizzle schema)**, not
  hand-written arrays — real constraints/transactions/query semantics, and
  seeding is inserting rows through the real schema/factories.
- tRPC gives end-to-end types, so Genio's ajv runtime request-validation layer
  isn't needed for safety.

### Concrete improvements over the Genio setup

| Genio | App Hub improvement |
|---|---|
| Playwright **Component Testing** + `page.route` interception | **Boot the real TanStack Start server with PGlite injected** on an ephemeral port; drive a real browser at it. SSR + server functions + client tRPC are all real — nothing to intercept (CT can't run server functions). |
| Routes shared between dev-middleware and `page.route` | **Dev "simulator mode" and IWFT become the same mechanism** — one server bootstrap with PGlite. Less code than Genio. |
| `EndpointBehaviourManager` + hand-maintained `EndpointKey` enum (ERROR/STALL/NETWORK) | A **test-only tRPC link/middleware** injecting errors/latency/network-fail by procedure path — type-safe, no enum to maintain. |
| Per-app `ROUTE_HANDLER_CLASSES` + `BackendSimulatorDb` + handler classes | A generic harness in `@hoe/test-kit` wrapping any app's real router + schema → a new app gets IWFT almost for free. |
| Reset = fresh in-memory arrays per test | Per-Playwright-worker PGlite instance + per-test transaction rollback (or fresh in-memory PGlite per test — WASM loads once). Must be designed into the harness. |

### Keep what Genio got right

The **two-seam** model (fast api-class/handler fakes for Vitest + whole-frontend
IWFT), Page Object Models, shared factories for seed+assert, fixed clock/locale,
and asserting against the backing store (call counts, persisted state).

### The tradeoff to decide explicitly

Reusing real handlers **couples** frontend tests to the real backend. Genio's
reimplementation buys *decoupling* — frontend tests pin the contract independent
of backend correctness. For App Hub (personal repo, leaf-node apps owning both
ends) the coupling is likely fine and the fidelity + zero-duplication win
dominates — but this is the decision that determines whether PGlite/Drizzle
belong in the test story at all, so it must be made explicitly.
