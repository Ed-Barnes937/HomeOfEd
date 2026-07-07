import { UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import { scryptHasher } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx } from '../../testing/makeCtx.ts'
import { LoginPasswordHandler } from './loginPasswordHandler.ts'

// Fake minter (the DI seam) — a deterministic two-part string, enough to assert
// the handler mints and returns a token without dragging node:crypto in.
const mintChildToken: ChildTokenMinter = (claims) => `token.${claims.childId}`
const deps = { hasher: scryptHasher, mintChildToken }

const seedChild = (store: FakeSproutStore, username = 'kid1234', parentId = 'p1') =>
  store.createChild({
    parentId,
    displayName: 'Kid',
    username,
    passwordHash: scryptHasher.hash(username),
    presetName: 'early-learner',
  })

describe('LoginPasswordHandler', () => {
  it('logs in with the correct username/password and mints a signed token', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    const result = await new LoginPasswordHandler(deps).run(
      { username: child.username, password: child.username, deviceToken: 'device-1' },
      ctx,
    )

    expect(result.child).toMatchObject({
      id: child.id,
      username: child.username,
      parentId: child.parentId,
      mustChangePassword: true,
    })
    expect(result.token.split('.')).toHaveLength(2)
  })

  it('registers a new device on first login', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    await new LoginPasswordHandler(deps).run(
      { username: child.username, password: child.username, deviceToken: 'device-1' },
      ctx,
    )

    const device = await store.getDeviceByToken('device-1')
    expect(device?.parentId).toBe(child.parentId)
  })

  it('does not error when the device is already registered', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    await store.createDevice({ parentId: child.parentId, deviceToken: 'device-1' })
    const ctx = makeCtx({ store })

    await expect(
      new LoginPasswordHandler(deps).run(
        { username: child.username, password: child.username, deviceToken: 'device-1' },
        ctx,
      ),
    ).resolves.toBeDefined()
  })

  it('rejects an unknown username with a generic error', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store })
    await expect(
      new LoginPasswordHandler(deps).run(
        { username: 'nope', password: 'whatever', deviceToken: 'device-1' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('rejects a wrong password with the SAME message as an unknown username', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    const messageFor = (input: { username: string; password: string }) =>
      new LoginPasswordHandler(deps)
        .run({ ...input, deviceToken: 'device-1' }, ctx)
        .catch((e: unknown) => (e as Error).message)

    const unknownUserMessage = await messageFor({ username: 'nope', password: 'x' })
    const wrongPasswordMessage = await messageFor({ username: child.username, password: 'wrong' })

    expect(unknownUserMessage).toBe(wrongPasswordMessage)
    expect(unknownUserMessage).toBe('Invalid username or password.')
  })
})
