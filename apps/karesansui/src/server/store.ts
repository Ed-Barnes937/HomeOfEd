/**
 * karesansui has no server-owned data (ADR 0008): the Store interface exists
 * to keep the layered skeleton and satisfy createAppServer's healthCheck seam,
 * not to persist anything. InMemoryStatusStore is the only impl and is used
 * as-is in prod, the dev simulator, and .iwft.
 */
export interface StatusStore {
  ping(): Promise<{ ok: true; value: string }>
}

export class InMemoryStatusStore implements StatusStore {
  ping(): Promise<{ ok: true; value: string }> {
    return Promise.resolve({ ok: true, value: 'garden is up' })
  }
}
