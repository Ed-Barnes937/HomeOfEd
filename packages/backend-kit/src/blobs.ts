/**
 * Blob persistence interface. The real impl (Tigris) is deferred until an app
 * actually stores a blob; the in-memory fake below is hardened in T2.2.
 */
export interface BlobStore {
  put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}

export class InMemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, Uint8Array>()

  put(key: string, body: Uint8Array): Promise<void> {
    this.blobs.set(key, body)
    return Promise.resolve()
  }
  get(key: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.blobs.get(key) ?? null)
  }
  delete(key: string): Promise<void> {
    this.blobs.delete(key)
    return Promise.resolve()
  }
}
