import { freshTestDb } from '@hoe/db'
import { ConsoleLogger, InMemoryBlobStore, type AppContext } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { GetYesterdayWordHandler } from './handlers/yesterdayWordHandler.ts'
import { migrations } from './migrations.ts'
import { wotdSchema } from './schema.ts'
import { DrizzleWotdStore, type NewWordRow, type WotdStore } from './store.ts'

// Same fixed clock as the today-words tests: "today" is 2026-07-05, so
// yesterday is 2026-07-04.
function makeCtx(store: WotdStore): AppContext<WotdStore> {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth: { getUser: () => null },
    now: () => new Date('2026-07-05T12:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

function seedRow(overrides: Partial<NewWordRow> = {}): NewWordRow {
  return {
    word: 'mirth',
    definition: 'great merriment or laughter',
    exampleSentence: 'The room filled with mirth.',
    alternatives: ['glee', 'cheer', 'joy'],
    wordType: 'noun',
    respelling: 'MURTH',
    difficulty: 'beginner',
    forDate: '2026-07-04',
    ...overrides,
  }
}

describe('GetYesterdayWordHandler', () => {
  it("returns yesterday's word, type and definition for the requested level", async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([seedRow()])

    const result = await new GetYesterdayWordHandler().run('beginner', makeCtx(store))

    expect(result).toEqual({
      word: 'mirth',
      wordType: 'noun',
      definition: 'great merriment or laughter',
    })
  })

  it('returns null when yesterday has no word at all', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))

    const result = await new GetYesterdayWordHandler().run('beginner', makeCtx(store))

    expect(result).toBeNull()
  })

  it("is level-scoped: another level's yesterday word does not leak across", async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([seedRow({ difficulty: 'expert', word: 'perspicacious' })])

    expect(await new GetYesterdayWordHandler().run('beginner', makeCtx(store))).toBeNull()
    expect(await new GetYesterdayWordHandler().run('expert', makeCtx(store))).toMatchObject({
      word: 'perspicacious',
    })
  })

  it("ignores today's and older rows — only yesterday's date counts", async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([
      seedRow({ forDate: '2026-07-05', word: 'today-word' }),
      seedRow({ forDate: '2026-07-03', word: 'older-word' }),
    ])

    const result = await new GetYesterdayWordHandler().run('beginner', makeCtx(store))

    expect(result).toBeNull()
  })

  it('returns a null wordType for rows stored before the redesign', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([seedRow({ wordType: undefined, respelling: undefined })])

    const result = await new GetYesterdayWordHandler().run('beginner', makeCtx(store))

    expect(result).toEqual({
      word: 'mirth',
      wordType: null,
      definition: 'great merriment or laughter',
    })
  })
})
