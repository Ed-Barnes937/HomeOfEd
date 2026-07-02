// Node-side failure injection, applied at the page.route trampoline BEFORE a
// request reaches the in-page dispatcher. Depends only on the frozen
// FailureRule shape — nothing from T2.2.
import type { FailureRule } from '@hoe/backend-kit'

/** tRPC procedure paths addressed by a request URL (batched = comma-separated). */
export function procedurePaths(url: string, endpoint: string): string[] {
  const pathname = new URL(url).pathname
  const start = pathname.indexOf(endpoint)
  const raw = start === -1 ? '' : pathname.slice(start + endpoint.length + 1)
  return decodeURIComponent(raw)
    .split(',')
    .filter((p) => p.length > 0)
}

/** First rule targeting any procedure in the request, or undefined. */
export function matchFailureRule(
  url: string,
  endpoint: string,
  rules: readonly FailureRule[],
): FailureRule | undefined {
  const paths = procedurePaths(url, endpoint)
  return rules.find((rule) => paths.includes(rule.path))
}

/**
 * A tRPC-shaped INTERNAL_SERVER_ERROR response for the whole request. If the
 * request is a batch, every procedure in it gets the error entry (per-entry
 * granularity inside one batch is not supported — one rule fails the request).
 */
export function injectedFailureResponse(
  url: string,
  endpoint: string,
): { status: number; contentType: string; body: string } {
  const paths = procedurePaths(url, endpoint)
  const isBatch = new URL(url).searchParams.get('batch') === '1'
  const errorFor = (path: string) => ({
    error: {
      message: `injected failure: ${path}`,
      code: -32603,
      data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path },
    },
  })
  const body = isBatch ? paths.map(errorFor) : errorFor(paths[0] ?? '')
  return { status: 500, contentType: 'application/json', body: JSON.stringify(body) }
}
