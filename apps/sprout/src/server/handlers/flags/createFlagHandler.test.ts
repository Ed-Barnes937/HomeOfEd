import { ForbiddenError, UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { childUser, makeCtx } from '../../testing/makeCtx.ts'
import { CreateFlagHandler } from './createFlagHandler.ts'

describe('CreateFlagHandler', () => {
  it('stores topics as a JSON string and records a probe event for a guardrail flag', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: childUser('c1', 'p1') })

    const result = await new CreateFlagHandler().run(
      {
        childId: 'c1',
        type: 'sensitive',
        reason: 'guardrail tripped',
        topics: ['self-harm', 'bullying'],
        deviceToken: 'device-1',
      },
      ctx,
    )

    const flag = await store.getFlag(result.id)
    expect(flag?.topics).toBe(JSON.stringify(['self-harm', 'bullying']))

    const probeCount = await store.countBehaviouralEvents({
      kind: 'probe',
      since: new Date(0),
      childId: 'c1',
    })
    expect(probeCount).toBe(1)
  })

  it('stores null topics when none are given', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: childUser('c1', 'p1') })

    const result = await new CreateFlagHandler().run(
      { childId: 'c1', type: 'blocked', reason: 'blocked content' },
      ctx,
    )

    const flag = await store.getFlag(result.id)
    expect(flag?.topics).toBeNull()
  })

  it("does NOT record a probe event for a child-initiated 'reported' flag", async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: childUser('c1', 'p1') })

    await new CreateFlagHandler().run(
      { childId: 'c1', type: 'reported', reason: 'child reported this' },
      ctx,
    )

    const probeCount = await store.countBehaviouralEvents({
      kind: 'probe',
      since: new Date(0),
      childId: 'c1',
    })
    expect(probeCount).toBe(0)
  })

  it("403s when the input childId does not match the authenticated child's session", async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: childUser('c1', 'p1') })

    await expect(
      new CreateFlagHandler().run({ childId: 'someone-else', type: 'blocked', reason: 'r' }, ctx),
    ).rejects.toThrow(ForbiddenError)
  })

  it('401s an anonymous caller', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store, user: null })

    await expect(
      new CreateFlagHandler().run({ childId: 'c1', type: 'blocked', reason: 'r' }, ctx),
    ).rejects.toThrow(UnauthorizedError)
  })
})
