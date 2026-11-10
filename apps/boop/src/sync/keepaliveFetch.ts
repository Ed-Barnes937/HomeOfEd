/**
 * The save client's fetch, with `keepalive` on the requests that may qualify
 * for it. A fetch started as the tab goes away dies with the document, and that
 * is the push carrying the last save (ADR 0080 decision 1).
 *
 * The keepalive budget is 64 KiB of body per page, while a slot may be 256 KiB
 * (ADR 0079), so a document over the budget goes as a plain fetch rather than
 * failing at the browser.
 */
export const KEEPALIVE_MAX_BYTES = 64 * 1024

export function keepaliveFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, withKeepalive(init))
}

export function withKeepalive(init: RequestInit = {}): RequestInit {
  return { ...init, keepalive: fitsKeepaliveBudget(init.body) }
}

function fitsKeepaliveBudget(body: BodyInit | null | undefined): boolean {
  if (body === null || body === undefined) return true
  if (typeof body !== 'string') return false
  return new TextEncoder().encode(body).length <= KEEPALIVE_MAX_BYTES
}
