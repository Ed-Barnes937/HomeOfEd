import { UnauthorizedError } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { FakeSproutStore } from '../../testing/fakeSproutStore.ts'
import { makeCtx, parentUser } from '../../testing/makeCtx.ts'
import { ListChildrenHandler } from './listChildrenHandler.ts'

describe('ListChildrenHandler', () => {
  it('lists only the authenticated parent\'s children', async () => {
    const store = new FakeSproutStore()
    await store.createChild({ parentId: 'p1', displayName: 'A', username: 'a', passwordHash: 'h' })
    await store.createChild({ parentId: 'p1', displayName: 'B', username: 'b', passwordHash: 'h' })
    await store.createChild({ parentId: 'p2', displayName: 'C', username: 'c', passwordHash: 'h' })

    const ctx = makeCtx({ store, user: parentUser('p1') })
    const rows = await new ListChildrenHandler().run(undefined, ctx)

    expect(rows.map((r) => r.displayName).sort()).toEqual(['A', 'B'])
  })

  it('401s an anonymous caller', async () => {
    const ctx = makeCtx({ user: null })
    await expect(new ListChildrenHandler().run(undefined, ctx)).rejects.toThrow(UnauthorizedError)
  })
})
