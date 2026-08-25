// The UK geo boundary (ADR-0011/0012/0013): the app-level Fastify `onRequest`
// hook is the LOAD-BEARING enforcement layer (the Cloudflare WAF rule is
// belt-and-braces). One predicate on every non-exempt path:
// `CF-IPCountry === 'GB'` passes; any other country code, the `XX`/`T1`
// sentinels, and a missing header are all refused — fail-closed, because
// behind Cloudflare the header is never absent, so missing strictly means the
// request bypassed Cloudflare (direct `.fly.dev`).
//
// A root-level onRequest hook registered inside the D9 `registerRoutes` hook
// applies to ALL routes, including /health and the tRPC plugin registered
// before it — exemption is therefore an exact-path check inside the hook.
import type { FastifyInstance } from '@hoe/backend-kit/server'

// Exact-match only (ADR-0012 item 3): no prefix matching, and `req.url`
// carries the query string, so `/terms?x=1` misses the set and is refused.
const EXEMPT_PATHS = new Set(['/health', '/terms', '/privacy'])

// The ADR-0013 "status notice" document: one generic self-contained response
// for EVERY refused matrix row — dark, monospace, status-code-first, under
// 1 KB, no assets or scripts. It names no country (a missing header has none).
// The copy is plain product prose; any edit drifting toward a legal assertion
// goes to counsel first (ADR-0013 item 3).
export const REFUSAL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>451 Unavailable For Legal Reasons</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #101410; color: #d6ddd6;
         font-family: ui-monospace, Menlo, Consolas, monospace; }
  main { padding: 2rem 1.5rem; max-width: 34rem; }
  h1 { font-size: 1rem; margin: 0 0 1.25rem; }
  h1 b { color: #8fce8f; }
  p { margin: 0.5rem 0; font-size: 0.875rem; line-height: 1.6; }
</style>
</head>
<body>
<main>
<h1><b>451</b> Unavailable For Legal Reasons</h1>
<p>Sprout is only available in the United Kingdom.</p>
<p>Sprout is UK-only while we complete our safety and legal work.</p>
</main>
</body>
</html>
`

/** Enforcement is ON by default; only `GEO_ENFORCEMENT=off` disables it
 * (ADR-0012 item 4 — set only by the docker-stack compose file). */
export function geoEnforcementEnabled(env: Record<string, string | undefined>): boolean {
  return env.GEO_ENFORCEMENT !== 'off'
}

/** Boot guard (ADR-0012 item 4): Fly injects FLY_APP_NAME into every machine,
 * so a GEO_ENFORCEMENT that reaches real infrastructure crashes the deploy
 * visibly instead of silently opening the boundary. */
export function assertGeoEnvSafe(env: Record<string, string | undefined>): void {
  if (env.GEO_ENFORCEMENT !== undefined && env.FLY_APP_NAME) {
    throw new Error(
      'GEO_ENFORCEMENT must not be set on real infrastructure (FLY_APP_NAME is present)',
    )
  }
}

/** Mount the boundary hook. Refusals return the ADR-0013 status notice with
 * `451`, `text/html; charset=utf-8`, and `cache-control: no-store` (a refusal
 * must never be served stale if the boundary posture changes). */
export function registerGeoBoundary(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (EXEMPT_PATHS.has(req.url)) return
    // A duplicated header arrives as an array and fails this check: refused.
    if (req.headers['cf-ipcountry'] === 'GB') return
    return reply
      .code(451)
      .header('content-type', 'text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(REFUSAL_HTML)
  })
}
