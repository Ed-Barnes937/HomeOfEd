import { ForbiddenError, NotFoundError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { evaluatePinAttempt } from '../../behavioural-limits.ts'
import { scryptHasher, verifySecret } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ResetPinHandler } from './resetPinHandler.ts'

async function seed(store: FakeSproutStore, parentId: string) {
  return store.createChild({
    parentId,
    displayName: 'Ben',
    username: `kid-${parentId}`,
    passwordHash: 'old-password-hash',
    pinHash: 'old-pin-hash',
    mustChangePassword: false,
  })
}

describe('ResetPinHandler', () => {
  it('clears the PIN and revives the first-login convention (password = username, mustChangePassword)', async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p1') })

    const result = await new ResetPinHandler(scryptHasher).run({ childId: child.id }, ctx)

    expect(result.username).toBe(child.username)
    const updated = await store.getChild(child.id)
    expect(updated?.pinHash).toBeNull()
    expect(updated?.mustChangePassword).toBe(true)
    expect(verifySecret(child.username, updated?.passwordHash ?? '')).toBe(true)
  })

  it('clears an active pin_fail lockout so the reset child can log in again', async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    for (let i = 0; i < 5; i++) {
      await store.recordBehaviouralEvent({ childId: child.id, kind: 'pin_fail' })
    }
    const ctx = makeCtx({ store, user: parentUser('p1') })
    await expect(evaluatePinAttempt(store, { childId: child.id })).resolves.toEqual(
      expect.objectContaining({ locked: true }),
    )

    await new ResetPinHandler(scryptHasher).run({ childId: child.id }, ctx)

    await expect(evaluatePinAttempt(store, { childId: child.id })).resolves.toEqual({
      locked: false,
    })
  })

  it('403s a cross-family reset', async () => {
    const store = new FakeSproutStore()
    const child = await seed(store, 'p1')
    const ctx = makeCtx({ store, user: parentUser('p2') })

    await expect(
      new ResetPinHandler(scryptHasher).run({ childId: child.id }, ctx),
    ).rejects.toThrow(ForbiddenError)
    const untouched = await store.getChild(child.id)
    expect(untouched?.pinHash).toBe('old-pin-hash')
  })

  it('404s an unknown child', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: parentUser('p1') })

    await expect(
      new ResetPinHandler(scryptHasher).run(
        { childId: '99999999-9999-4999-8999-999999999999' },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })
})
