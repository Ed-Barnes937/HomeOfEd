import { describe, expect, it } from 'vitest'

import { InMemoryBlobStore } from './blobs.ts'

describe('InMemoryBlobStore', () => {
  it('round-trips a blob', async () => {
    const store = new InMemoryBlobStore()
    await store.put('a/key', new Uint8Array([1, 2, 3]))

    expect(await store.get('a/key')).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('returns null for a missing key', async () => {
    const store = new InMemoryBlobStore()

    expect(await store.get('missing')).toBeNull()
  })

  it('is immune to caller mutation of the put body', async () => {
    const store = new InMemoryBlobStore()
    const body = new Uint8Array([1, 2, 3])
    await store.put('key', body)
    body[0] = 99

    expect(await store.get('key')).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('is immune to caller mutation of the got body', async () => {
    const store = new InMemoryBlobStore()
    await store.put('key', new Uint8Array([1, 2, 3]))
    const got = await store.get('key')
    got![0] = 99

    expect(await store.get('key')).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('deletes a blob; deleting a missing key is a no-op', async () => {
    const store = new InMemoryBlobStore()
    await store.put('key', new Uint8Array([1]))
    await store.delete('key')

    expect(await store.get('key')).toBeNull()
    await expect(store.delete('key')).resolves.toBeUndefined()
  })

  it('retains the stored contentType (fake-only introspection)', async () => {
    const store = new InMemoryBlobStore()
    await store.put('typed', new Uint8Array([1]), { contentType: 'image/png' })
    await store.put('untyped', new Uint8Array([1]))

    expect(store.contentTypeOf('typed')).toBe('image/png')
    expect(store.contentTypeOf('untyped')).toBeNull()
    expect(store.contentTypeOf('missing')).toBeNull()
  })

  it('put overwrites an existing key, including its contentType', async () => {
    const store = new InMemoryBlobStore()
    await store.put('key', new Uint8Array([1]), { contentType: 'text/plain' })
    await store.put('key', new Uint8Array([2]))

    expect(await store.get('key')).toEqual(new Uint8Array([2]))
    expect(store.contentTypeOf('key')).toBeNull()
  })
})
