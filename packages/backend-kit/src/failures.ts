/**
 * Test-only failure injection by procedure path, applied as a tRPC link.
 * SIGNATURE FROZEN in T1.1 — implemented in T2.2 (link) and surfaced through
 * @hoe/test-kit's mountApp({ failures }) in T2.4.
 */
export type FailureRule = {
  path: string
  mode: 'error' | 'latency' | 'network'
  ms?: number
}
