import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx } from '../../testing/makeCtx.ts'
import { DeviceChildrenHandler } from './deviceChildrenHandler.ts'

describe('DeviceChildrenHandler', () => {
  it("returns only the device's registered parent's children, with their PIN state", async () => {
    const store = new FakeSproutStore()
    const child1 = await store.createChild({
      parentId: 'p1',
      displayName: 'Kid One',
      username: 'kid1',
      passwordHash: 'x',
      pinHash: 'pin-hash',
      presetName: 'early-learner',
    })
    // A reset child: pinHash cleared — the picker must know to skip the PIN screen.
    const child2 = await store.createChild({
      parentId: 'p1',
      displayName: 'Reset Kid',
      username: 'kid2',
      passwordHash: 'x',
      pinHash: null,
      presetName: 'early-learner',
    })
    await store.createChild({
      parentId: 'p2',
      displayName: 'Other Kid',
      username: 'kid3',
      passwordHash: 'x',
      presetName: 'early-learner',
    })
    await store.createDevice({ parentId: 'p1', deviceToken: 'device-1' })
    const ctx = makeCtx({ store })

    const result = await new DeviceChildrenHandler().run({ deviceToken: 'device-1' }, ctx)

    expect(result.children).toEqual([
      { id: child1.id, displayName: 'Kid One', presetName: 'early-learner', hasPin: true },
      { id: child2.id, displayName: 'Reset Kid', presetName: 'early-learner', hasPin: false },
    ])
  })

  it('returns an empty list for an unregistered device token', async () => {
    const store = new FakeSproutStore()
    const ctx = makeCtx({ store })

    const result = await new DeviceChildrenHandler().run({ deviceToken: 'unknown' }, ctx)

    expect(result.children).toEqual([])
  })
})
