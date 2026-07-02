/**
 * Blob persistence interface. The real impl (Tigris) is deferred until an app
 * actually stores a blob; the in-memory fake below is the simulator/test impl.
 */
export interface BlobStore {
  put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}

type StoredBlob = { body: Uint8Array; contentType: string | null }

/**
 * In-memory BlobStore fake. Bodies are copied on put and on get, so neither
 * side can mutate stored state through a shared buffer. Deleting a missing
 * key is a no-op (matching S3-style object-store semantics).
 */
export class InMemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, StoredBlob>()

  put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void> {
    this.blobs.set(key, { body: new Uint8Array(body), contentType: opts?.contentType ?? null })
    return Promise.resolve()
  }
  get(key: string): Promise<Uint8Array | null> {
    const stored = this.blobs.get(key)
    return Promise.resolve(stored ? new Uint8Array(stored.body) : null)
  }
  delete(key: string): Promise<void> {
    this.blobs.delete(key)
    return Promise.resolve()
  }
  /** Fake-only introspection (not part of the frozen BlobStore interface). */
  contentTypeOf(key: string): string | null {
    return this.blobs.get(key)?.contentType ?? null
  }
}
