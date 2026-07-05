import { freshTestDb } from '@hoe/db'
import { describe, expect, it } from 'vitest'

import { migrations } from './migrations.ts'
import { wotdSchema } from './schema.ts'
import { DrizzleWotdStore, type NewWordRow } from './store.ts'

function row(overrides: Partial<NewWordRow> = {}): NewWordRow {
  return {
    word: 'ephemeral',
    definition: 'lasting a very short time',
    exampleSentence: 'The ephemeral bloom faded by noon.',
    alternatives: ['fleeting', 'transient', 'momentary'],
    difficulty: 'beginner',
    forDate: '2026-07-05',
    ...overrides,
  }
}

describe('DrizzleWotdStore over PGlite with the generated migrations', () => {
  it('persists a word and reads it back for its date, synonyms array intact', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([row()])

    const rows = await store.getWordsForDate('2026-07-05')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      word: 'ephemeral',
      exampleSentence: 'The ephemeral bloom faded by noon.',
      alternatives: ['fleeting', 'transient', 'momentary'],
      difficulty: 'beginner',
      forDate: '2026-07-05',
    })
  })

  it('returns an empty array for a date with no words', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([row({ forDate: '2026-07-05' })])
    await expect(store.getWordsForDate('2026-07-06')).resolves.toEqual([])
  })

  it('scopes reads to the requested date only', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([
      row({ forDate: '2026-07-05', difficulty: 'beginner' }),
      row({ forDate: '2026-07-06', difficulty: 'beginner', word: 'zephyr' }),
    ])
    const rows = await store.getWordsForDate('2026-07-06')
    expect(rows.map((r) => r.word)).toEqual(['zephyr'])
  })

  it('ignores a conflicting insert on (for_date, difficulty) — idempotent generation', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([row({ word: 'first' })])
    // A lost race: a second generation for the same day+level is dropped.
    await store.insertWords([row({ word: 'second' })])

    const rows = await store.getWordsForDate('2026-07-05')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.word).toBe('first')
  })

  it('inserts one word per difficulty for a day without conflict', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([
      row({ difficulty: 'beginner' }),
      row({ difficulty: 'intermediate' }),
      row({ difficulty: 'advanced' }),
      row({ difficulty: 'expert' }),
    ])
    const rows = await store.getWordsForDate('2026-07-05')
    expect(rows.map((r) => r.difficulty).sort()).toEqual([
      'advanced',
      'beginner',
      'expert',
      'intermediate',
    ])
  })

  it('ping resolves against a live database', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await expect(store.ping()).resolves.toBeUndefined()
  })

  it('insertWords with no rows is a no-op', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await expect(store.insertWords([])).resolves.toBeUndefined()
    await expect(store.getWordsForDate('2026-07-05')).resolves.toEqual([])
  })
})
