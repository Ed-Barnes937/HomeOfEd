# 13 — UK geo boundary: the 451 hook, exemptions, and escape hatch

**What to build:** Every request that does not carry `CF-IPCountry: GB` is refused with
the `451` status notice before reaching any app surface, except `/health`, `/terms`, and
`/privacy`; UK visitors and health checks are unaffected; the docker stack can opt out;
real infrastructure cannot. (ADR-0011 / ADR-0012 / ADR-0013; spec "UK geo boundary".)

**Blocked by:** 12 — ToS & Privacy draft documents (the exempt list names `/terms` and
`/privacy`, and the boundary tests assert they pass headerless).

**Status:** resolved

- [x] One new sprout server module owns the boundary: a Fastify `onRequest` hook plus the
      refusal document, registered through the existing `registerRoutes` wiring (beside
      the `x-sprout-parent` hook). No backend-kit change.
- [x] Refusal matrix: `CF-IPCountry === 'GB'` passes; any other country code, `XX`, `T1`,
      and a **missing header** are all refused (fail-closed).
- [x] Exempt paths are three exact-match strings: `/health`, `/terms`, `/privacy`. No
      prefix match; query-stringed variants (`/terms?x=1`) and near-misses (`/healthx`)
      are refused.
- [x] Refusals return `451` with the one generic self-contained status-notice body
      (dark, monospace, status-code-first, under 1 KB, no assets): *"Sprout is only
      available in the United Kingdom."* and *"Sprout is UK-only while we complete our
      safety and legal work."* Headers: `content-type: text/html; charset=utf-8`,
      `cache-control: no-store`. Same body for every refused row; no country named.
- [x] `GEO_ENFORCEMENT=off` disables the hook; only the docker-stack compose file sets
      it. A boot guard in the prod entrypoint throws if it is set while `FLY_APP_NAME`
      exists (the `CHILD_SESSION_SECRET` fail-fast idiom), with a unit test.
- [x] The CI deploy workflow gains the smoke-constraint comment: smoke URLs stay on
      `.fly.dev` and touch only geo-exempt paths (ADR-0011 item 4).
- [x] Unit tests over the composed app server (chat-SSE-test / backend-kit inject prior
      art) cover every matrix row per path, both exempt and non-exempt, asserting
      status, body, and headers.
- [x] Dev simulator mode is unaffected (the hook is not in the simulator path); verify
      loop green.

## Comments
**2026-08-25 (agent):** Built as specified. `apps/sprout/src/server/geo-boundary.ts` owns
the boundary: the `onRequest` hook (exact-match exempt set, `CF-IPCountry === 'GB'`
predicate, fail-closed on missing/`XX`/`T1`/array-valued headers), the ADR-0013 status
notice (`REFUSAL_HTML`, ~860 bytes), `geoEnforcementEnabled`, and the `assertGeoEnvSafe`
boot guard. `main.ts` calls the guard beside the `CHILD_SESSION_SECRET` fail-fast and
registers the hook FIRST in `registerRoutes` — verified empirically that a root-level
`onRequest` hook added there applies to every route, including `/health` and the tRPC
plugin registered earlier, so no backend-kit change was needed. `compose.yml` is the only
setter of `GEO_ENFORCEMENT=off`. Unit tests (`geo-boundary.test.ts`, 47 tests) drive the
real wiring over `buildAppServer` + inject: all five matrix rows × five non-exempt + three
exempt paths, asserting status, headers, and body per row; the response contract; the
escape hatch; and the boot guard. One deliberate step beyond the ticket's "gains the
comment" line: the sprout CI smoke's SPA-index/asset checks had to go (a US runner is now
451'd on `/` by design), so the smoke was constrained to geo-exempt paths and gained a
`test $code = 451` assertion on `/` — the deploy now proves the load-bearing boundary is
live. Simulator path untouched. Verify loop green: lint, typecheck, 199 unit + 23
whole-frontend tests. Two-axis code review: no hard violations; its one spec finding
(matrix rows asserted status-only) was fixed before commit; the shared test-server-builder
extraction (three copies of the inject scaffold now exist) is noted as deferrable cleanup.
