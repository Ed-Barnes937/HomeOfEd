import { NotFoundError, UnauthorizedError, ValidationError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { scryptHasher, verifySecret } from '../../password.ts'
import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx } from '../../testing/makeCtx.ts'
import { ChangePasswordHandler } from './changePasswordHandler.ts'

const deps = { hasher: scryptHasher }

const seedChild = (store: FakeSproutStore, mustChangePassword = true) =>
  store.createChild({
    parentId: 'p1',
    displayName: 'Kid',
    username: 'kid1234',
    passwordHash: scryptHasher.hash('kid1234'),
    pinHash: scryptHasher.hash('4321'),
    presetName: 'early-learner',
    mustChangePassword,
  })

describe('ChangePasswordHandler', () => {
  it('changes the password when proven with the temp password', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    const result = await new ChangePasswordHandler(deps).run(
      { childId: child.id, newPassword: 'newpass1', password: 'kid1234' },
      ctx,
    )

    expect(result.child.mustChangePassword).toBe(false)
    const updated = await store.getChild(child.id)
    expect(verifySecret('newpass1', updated?.passwordHash ?? '')).toBe(true)
  })

  it('changes the password when proven with the PIN', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    await new ChangePasswordHandler(deps).run(
      { childId: child.id, newPassword: 'newpass1', pin: '4321' },
      ctx,
    )

    const updated = await store.getChild(child.id)
    expect(updated?.mustChangePassword).toBe(false)
  })

  it('rejects when neither the temp password nor the PIN prove identity', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: child.id, newPassword: 'newpass1', password: 'wrong', pin: 'wrong' },
        ctx,
      ),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('rejects once the password has already been set', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store, false)
    const ctx = makeCtx({ store })

    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: child.id, newPassword: 'newpass1', password: 'kid1234' },
        ctx,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a new password shorter than the minimum length', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: child.id, newPassword: 'ab', password: 'kid1234' },
        ctx,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a new password equal to the username', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: child.id, newPassword: child.username, password: 'kid1234' },
        ctx,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('also sets a fresh PIN when a reset (PIN-less) child supplies one', async () => {
    const store = new FakeSproutStore()
    // A reset child: password back to username, no PIN.
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid1234',
      passwordHash: scryptHasher.hash('kid1234'),
      pinHash: null,
      presetName: 'early-learner',
      mustChangePassword: true,
    })
    const ctx = makeCtx({ store })

    const result = await new ChangePasswordHandler(deps).run(
      { childId: child.id, newPassword: 'newpass1', password: 'kid1234', newPin: '7788' },
      ctx,
    )

    expect(result.child.hasPin).toBe(true)
    const updated = await store.getChild(child.id)
    expect(verifySecret('7788', updated?.pinHash ?? '')).toBe(true)
  })

  it('rejects a malformed new PIN', async () => {
    const store = new FakeSproutStore()
    const child = await seedChild(store)
    const ctx = makeCtx({ store })

    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: child.id, newPassword: 'newpass1', password: 'kid1234', newPin: '12' },
        ctx,
      ),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects a reset (PIN-less) child completing without a fresh PIN', async () => {
    // A PIN-less but established child is a state nothing else in the flow
    // wants (ADR 0037) — the recovery step must set BOTH credentials.
    const store = new FakeSproutStore()
    const child = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid',
      username: 'kid1234',
      passwordHash: scryptHasher.hash('kid1234'),
      pinHash: null,
      presetName: 'early-learner',
      mustChangePassword: true,
    })
    const ctx = makeCtx({ store })

    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: child.id, newPassword: 'newpass1', password: 'kid1234' },
        ctx,
      ),
    ).rejects.toThrow(ValidationError)
    const untouched = await store.getChild(child.id)
    expect(untouched?.mustChangePassword).toBe(true)
  })

  it('rejects an unknown child id', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store })
    await expect(
      new ChangePasswordHandler(deps).run(
        { childId: 'missing', newPassword: 'newpass1', password: 'x' },
        ctx,
      ),
    ).rejects.toThrow(NotFoundError)
  })
})
