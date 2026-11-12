/** The slices of `navigator` that persistence needs; either may be missing. */
export interface PersistenceApi {
  permissions?: { query(descriptor: { name: 'persistent-storage' }): Promise<{ state: string }> }
  storage?: { persist?(): Promise<boolean> }
}

/** Asks the browser not to evict silt's scenes, but only where asking cannot show a prompt (ADR 0102). */
export async function persistWithoutPrompt(api: PersistenceApi): Promise<void> {
  if (!api.permissions?.query || !api.storage?.persist) return
  let state: string
  try {
    state = (await api.permissions.query({ name: 'persistent-storage' })).state
  } catch {
    return
  }
  if (state !== 'prompt') await api.storage.persist()
}
