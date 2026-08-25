# 13 — UK geo boundary: the 451 hook, exemptions, and escape hatch

**What to build:** Every request that does not carry `CF-IPCountry: GB` is refused with
the `451` status notice before reaching any app surface, except `/health`, `/terms`, and
`/privacy`; UK visitors and health checks are unaffected; the docker stack can opt out;
real infrastructure cannot. (ADR-0011 / ADR-0012 / ADR-0013; spec "UK geo boundary".)

**Blocked by:** 12 — ToS & Privacy draft documents (the exempt list names `/terms` and
`/privacy`, and the boundary tests assert they pass headerless).

**Status:** ready-for-agent

- [ ] One new sprout server module owns the boundary: a Fastify `onRequest` hook plus the
      refusal document, registered through the existing `registerRoutes` wiring (beside
      the `x-sprout-parent` hook). No backend-kit change.
- [ ] Refusal matrix: `CF-IPCountry === 'GB'` passes; any other country code, `XX`, `T1`,
      and a **missing header** are all refused (fail-closed).
- [ ] Exempt paths are three exact-match strings: `/health`, `/terms`, `/privacy`. No
      prefix match; query-stringed variants (`/terms?x=1`) and near-misses (`/healthx`)
      are refused.
- [ ] Refusals return `451` with the one generic self-contained status-notice body
      (dark, monospace, status-code-first, under 1 KB, no assets): *"Sprout is only
      available in the United Kingdom."* and *"Sprout is UK-only while we complete our
      safety and legal work."* Headers: `content-type: text/html; charset=utf-8`,
      `cache-control: no-store`. Same body for every refused row; no country named.
- [ ] `GEO_ENFORCEMENT=off` disables the hook; only the docker-stack compose file sets
      it. A boot guard in the prod entrypoint throws if it is set while `FLY_APP_NAME`
      exists (the `CHILD_SESSION_SECRET` fail-fast idiom), with a unit test.
- [ ] The CI deploy workflow gains the smoke-constraint comment: smoke URLs stay on
      `.fly.dev` and touch only geo-exempt paths (ADR-0011 item 4).
- [ ] Unit tests over the composed app server (chat-SSE-test / backend-kit inject prior
      art) cover every matrix row per path, both exempt and non-exempt, asserting
      status, body, and headers.
- [ ] Dev simulator mode is unaffected (the hook is not in the simulator path); verify
      loop green.

## Comments
