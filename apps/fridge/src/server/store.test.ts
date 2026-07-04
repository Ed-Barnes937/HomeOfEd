import { freshTestDb } from '@hoe/db'
import { describe, expect, it } from 'vitest'

import type { StoredBoard } from './boardSchema.ts'
import { migrations } from './migrations.ts'
import { fridgeSchema } from './schema.ts'
import { DrizzleFridgeStore } from './store.ts'

const board = (name: string): StoredBoard => ({
  name,
  finish: 'mint',
  wall: 'warm',
  magnets: [{ type: 'letter', label: 'A', deg: 0, color: 'red', x: 100, y: 40, rot: 0 }],
})

describe('DrizzleFridgeStore over PGlite with the generated migrations', () => {
  it('pings after migration', async () => {
    const db = await freshTestDb(fridgeSchema, migrations)
    const store = new DrizzleFridgeStore(db)
    await expect(store.ping()).resolves.toEqual({ ok: true })
  })

  it('round-trips an inserted shared board', async () => {
    const db = await freshTestDb(fridgeSchema, migrations)
    const store = new DrizzleFridgeStore(db)
    const payload = board('HELLO')
    await store.insertSharedBoard('abcABC1234', 'HELLO', payload)
    await expect(store.getSharedBoard('abcABC1234')).resolves.toEqual({ name: 'HELLO', payload })
  })

  it('returns null for an unknown id', async () => {
    const db = await freshTestDb(fridgeSchema, migrations)
    const store = new DrizzleFridgeStore(db)
    await expect(store.getSharedBoard('missing0000')).resolves.toBeNull()
  })

  it('throws when the id already exists (primary-key conflict)', async () => {
    const db = await freshTestDb(fridgeSchema, migrations)
    const store = new DrizzleFridgeStore(db)
    await store.insertSharedBoard('dupe123456', 'first', board('first'))
    await expect(store.insertSharedBoard('dupe123456', 'second', board('second'))).rejects.toThrow()
  })
})
