import { describe, expect, it } from 'vitest'

import { FakeFamilyClient } from './fakeFamilyClient.ts'

const now = () => new Date('2026-01-01T00:00:00Z')

const signedIn = () => {
  const client = new FakeFamilyClient({ now })
  client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
  return client
}

describe('FakeFamilyClient (save contract)', () => {
  it('round-trips a put through get, versioning server-side', async () => {
    const client = signedIn()
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()

    const first = await client.put({ appId: 'boop', slotKey: 'boop:save', blob: '{"a":1}' })
    expect(first).toEqual({ version: 1 })

    const got = await client.get({ appId: 'boop', slotKey: 'boop:save' })
    expect(got).toEqual({ blob: '{"a":1}', version: 1, updatedAt: now().getTime() })

    // An unconditional overwrite bumps the version.
    const second = await client.put({ appId: 'boop', slotKey: 'boop:save', blob: '{"a":2}' })
    expect(second).toEqual({ version: 2 })
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('{"a":2}')
  })

  it('lists slot metadata without blobs, scoped to the appId', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'héllo' })
    await client.put({ appId: 'silt', slotKey: 'silt:scene:1', blob: 'x' })

    const slots = await client.list({ appId: 'boop' })
    expect(slots).toEqual([
      {
        slotKey: 'boop:save',
        version: 1,
        // sizeBytes is UTF-8 bytes, not code units: é is 2 bytes.
        sizeBytes: 6,
        updatedAt: now().getTime(),
      },
    ])
  })

  it('deletes a slot', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })
    await client.delete({ appId: 'boop', slotKey: 'boop:save' })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()
    expect(await client.list({ appId: 'boop' })).toEqual([])
  })

  it('scopes saves per account - switching profile switches the data', async () => {
    const client = new FakeFamilyClient({ now })
    client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'robins' })

    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()

    client.signInAs({ sub: 'child-1', role: 'child', parentId: 'parent-1', name: 'Robin' })
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('robins')
  })

  it('rejects every call when signed out, like the real router', async () => {
    const client = new FakeFamilyClient({ now })
    await expect(client.get({ appId: 'boop', slotKey: 'boop:save' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    client.signOut()
    await expect(client.put({ appId: 'boop', slotKey: 'k', blob: 'x' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('failWith makes every call reject (offline degradation) until cleared', async () => {
    const client = signedIn()
    await client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })

    client.failWith(new Error('service unreachable'))
    await expect(client.get({ appId: 'boop', slotKey: 'boop:save' })).rejects.toThrow(
      'service unreachable',
    )
    await expect(client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'y' })).rejects.toThrow()

    client.failWith(null)
    expect((await client.get({ appId: 'boop', slotKey: 'boop:save' }))?.blob).toBe('x')
  })

  it('exposes the active session for harness assertions', () => {
    const client = new FakeFamilyClient({ now })
    expect(client.activeSession()).toBeNull()
    client.signInAs({ sub: 'parent-1', role: 'parent', name: 'Ed' })
    expect(client.activeSession()?.sub).toBe('parent-1')
  })
})
