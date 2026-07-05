import { freshTestDb } from '@hoe/db'
import { ConsoleLogger, InMemoryBlobStore, type AppContext } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { GetTodayWordsHandler } from './handlers/todayWordsHandler.ts'
import { migrations } from './migrations.ts'
import { wotdSchema } from './schema.ts'
import { DrizzleWotdStore, type NewWordRow, type WordRow, type WotdStore } from './store.ts'
import { DIFFICULTIES, type GeneratedWord, type WordGenerator } from './wordGenerator.ts'

function makeCtx(store: WotdStore): AppContext<WotdStore> {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth: { getUser: () => null },
    now: () => new Date('2026-07-05T12:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

function generatedWord(overrides: Partial<GeneratedWord> = {}): GeneratedWord {
  return {
    difficulty: 'beginner',
    word: 'ephemeral',
    definition: 'lasting a very short time',
    exampleSentence: 'The ephemeral bloom faded by noon.',
    synonyms: ['fleeting', 'transient', 'momentary'],
    ...overrides,
  }
}

function allFourGenerated(): GeneratedWord[] {
  return DIFFICULTIES.map((difficulty) =>
    generatedWord({ difficulty, word: `${difficulty}-word` }),
  )
}

/** Counts calls so tests can assert the generator was (not) invoked. */
class CountingGenerator implements WordGenerator {
  calls = 0
  constructor(private readonly words: GeneratedWord[]) {}

  generateDailyWords(): Promise<GeneratedWord[]> {
    this.calls += 1
    return Promise.resolve(this.words)
  }
}

function seedRow(overrides: Partial<NewWordRow> = {}): NewWordRow {
  return {
    word: 'preexisting',
    definition: 'already there',
    exampleSentence: 'It was already there.',
    alternatives: ['a', 'b', 'c'],
    difficulty: 'beginner',
    forDate: '2026-07-05',
    ...overrides,
  }
}

describe('GetTodayWordsHandler', () => {
  it('returns an existing complete set without calling the generator', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords(DIFFICULTIES.map((difficulty) => seedRow({ difficulty })))

    const generator = new CountingGenerator(allFourGenerated())
    const result = await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))

    expect(generator.calls).toBe(0)
    expect(result).toHaveLength(4)
    expect(result.map((w) => w.difficulty).sort()).toEqual([...DIFFICULTIES].sort())
  })

  it('generates and persists a full set when today has no words', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    const generator = new CountingGenerator(allFourGenerated())

    const result = await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))

    expect(generator.calls).toBe(1)
    expect(result).toHaveLength(4)
    expect(result.map((w) => w.difficulty).sort()).toEqual([...DIFFICULTIES].sort())

    const persisted = await store.getWordsForDate('2026-07-05')
    expect(persisted).toHaveLength(4)
  })

  it('keeps a pre-seeded row on a lost race and still returns the complete set', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([seedRow({ difficulty: 'beginner', word: 'winner-of-the-race' })])

    const generator = new CountingGenerator(allFourGenerated())
    const result = await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))

    expect(generator.calls).toBe(1)
    expect(result).toHaveLength(4)
    const beginnerWord = result.find((w) => w.difficulty === 'beginner')
    expect(beginnerWord?.word).toBe('winner-of-the-race')
  })

  it('throws when the re-select after generation is still incomplete', async () => {
    // Hand-written fake: insertWords is a no-op, getWordsForDate always returns
    // an incomplete set — simulates generation succeeding but persistence
    // silently failing to fill every difficulty.
    class NeverPersistsStore implements WotdStore {
      getWordsForDate(): Promise<WordRow[]> {
        return Promise.resolve([])
      }
      insertWords(): Promise<void> {
        return Promise.resolve()
      }
      ping(): Promise<void> {
        return Promise.resolve()
      }
    }

    const generator = new CountingGenerator(allFourGenerated())
    const handler = new GetTodayWordsHandler(generator)

    await expect(handler.run(undefined, makeCtx(new NeverPersistsStore()))).rejects.toThrow()
  })
})
