import { ForbiddenError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import type { ChildTokenMinter } from '../../auth/childTokenPort.ts'
import { BEHAVIOURAL_LIMITS } from '../../behavioural-limits.ts'
import { scryptHasher } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { LoginPinFromParentHandler } from './loginPinFromParentHandler.ts'

const mintChildToken: ChildTokenMinter = (claims) => `token.${claims.childId}`
const deps = { hasher: scryptHasher, mintChildToken }
const now = () => new Date('2026-01-01T00:00:00Z')

const seedChild = (store: FakeSproutStore, parentId = 'p1') =>
  store.createChild({
    parentId,
    displayName: 'Kid',
    username: `kid-${parentId}`,
    passwordHash: scryptHasher.hash('realpass'),
    pinHash: scryptHasher.hash('4321'),
    presetName: 'early-learner',
  })

describe('LoginPinFromParentHandler', () => {
  it('logs the parent’s child in with just the PIN and registers the device', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now, user: parentUser('p1') })

    const result = await new LoginPinFromParentHandler(deps).run(
      { childId: child.id, pin: '4321', deviceToken: 'device-1' },
      ctx,
    )

    expect(result.child.id).toBe(child.id)
    expect(result.token).toBe(`token.${child.id}`)
    expect((await store.getDeviceByToken('device-1'))?.parentId).toBe('p1')
  })

  it('requires a signed-in parent', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)

    for (const user of [null, childUser(child.id, 'p1')]) {
      await expect(
        new LoginPinFromParentHandler(deps).run(
          { childId: child.id, pin: '4321', deviceToken: 'd' },
          makeCtx({ store, now, user }),
        ),
      ).rejects.toThrow(UnauthorizedError)
    }
  })

  it('refuses another family’s child, even with the right PIN', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store, 'p2')
    const ctx = makeCtx({ store, now, user: parentUser('p1') })

    await expect(
      new LoginPinFromParentHandler(deps).run(
        { childId: child.id, pin: '4321', deviceToken: 'd' },
        ctx,
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects a wrong PIN, records a pin_fail, and does not register the device', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now, user: parentUser('p1') })

    await expect(
      new LoginPinFromParentHandler(deps).run(
        { childId: child.id, pin: '0000', deviceToken: 'device-1' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)

    const failCount = await store.countBehaviouralEvents({
      kind: 'pin_fail',
      since: new Date('2025-01-01T00:00:00Z'),
      childId: child.id,
    })
    expect(failCount).toBe(1)
    expect(await store.getDeviceByToken('device-1')).toBeNull()
  })

  it('shares the PIN lockout with the device PIN login', async () => {
    const store = new FakeSproutStore(now)
    const child = await seedChild(store)
    const ctx = makeCtx({ store, now, user: parentUser('p1') })

    for (let i = 0; i < BEHAVIOURAL_LIMITS.maxPinFailures; i++) {
      await store.recordBehaviouralEvent({ childId: child.id, kind: 'pin_fail' })
    }

    await expect(
      new LoginPinFromParentHandler(deps).run(
        { childId: child.id, pin: '4321', deviceToken: 'd' },
        ctx,
      ),
    ).rejects.toThrow(ForbiddenError)
  })
})
