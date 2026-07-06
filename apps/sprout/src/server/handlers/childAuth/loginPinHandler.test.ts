import { ForbiddenError, NotFoundError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import { BEHAVIOURAL_LIMITS } from '../../behavioural-limits.ts'
import { scryptHasher } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx } from '../../testing/makeCtx.ts'
import { LoginPinHandler } from './loginPinHandler.ts'

// Fake minter (the DI seam) — a deterministic two-part string, enough to assert
// the handler mints and returns a token without dragging node:crypto in.
const mintChildToken: ChildTokenMinter = (claims) => `token.${claims.childId}`
const deps = { hasher: scryptHasher, mintChildToken }
const now = () => new Date('2026-01-01T00:00:00Z')

const seedChild = (store: FakeSproutStore, pin = '4321') =>
  store.createChild({
    parentId: 'p1',
    displayName: 'Kid',
    username: 'kid1234',
    passwordHash: scryptHasher.hash('kid1234'),
    pinHash: scryptHasher.hash(pin),
    presetName: 'early-learner',
  })

describe('LoginPinHandler', () => {
  it('logs in with the correct PIN and mints a signed token', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now })

    const result = await new LoginPinHandler(deps).run(
      { childId: child.id, pin: '4321', deviceToken: 'device-1' },
      ctx,
    )

    expect(result.child.id).toBe(child.id)
    expect(result.token.split('.')).toHaveLength(2)
  })

  it('rejects an unknown child id', async () => {
    const store = new FakeSproutStore(now)
    const ctx = makeCtx({ store, now })
    await expect(
      new LoginPinHandler(deps).run({ childId: 'missing', pin: '1234', deviceToken: 'd' }, ctx),
    ).rejects.toThrow(NotFoundError)
  })

  it('records a pin_fail event and rejects a wrong PIN', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now })

    await expect(
      new LoginPinHandler(deps).run(
        { childId: child.id, pin: 'wrong', deviceToken: 'device-1' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)

    const failCount = await store.countBehaviouralEvents({
      kind: 'pin_fail',
      since: new Date('2025-01-01T00:00:00Z'),
      childId: child.id,
    })
    expect(failCount).toBe(1)
  })

  it('locks out after too many incorrect PIN attempts, even with the correct PIN', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now })

    for (let i = 0; i < BEHAVIOURAL_LIMITS.maxPinFailures; i++) {
      await new LoginPinHandler(deps)
        .run({ childId: child.id, pin: 'wrong', deviceToken: 'device-1' }, ctx)
        .catch(() => undefined)
    }

    await expect(
      new LoginPinHandler(deps).run(
        { childId: child.id, pin: '4321', deviceToken: 'device-1' },
        ctx,
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it('does not register a device (source parity: only loginPassword does)', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now })

    await new LoginPinHandler(deps).run(
      { childId: child.id, pin: '4321', deviceToken: 'device-1' },
      ctx,
    )

    expect(await store.getDeviceByToken('device-1')).toBeNull()
  })
})
