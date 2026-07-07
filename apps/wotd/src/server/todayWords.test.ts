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

/** Counts calls and records exclusions so tests can assert on both. */
class CountingGenerator implements WordGenerator {
  calls = 0
  lastExclusions: string[] = []
  constructor(private readonly words: GeneratedWord[]) {}

  generateDailyWords(exclusions: string[]): Promise<GeneratedWord[]> {
    this.calls += 1
    this.lastExclusions = exclusions
    return Promise.resolve(this.words)
  }
}

/** Returns a scripted set per call (last entry repeats once exhausted). */
class ScriptedGenerator implements WordGenerator {
  calls = 0
  constructor(private readonly scripts: GeneratedWord[][]) {}

  generateDailyWords(): Promise<GeneratedWord[]> {
    const words = this.scripts[Math.min(this.calls, this.scripts.length - 1)]
    this.calls += 1
    if (!words) throw new Error('ScriptedGenerator has no scripts')
    return Promise.resolve(words)
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

  it('passes recent words (within the 90-day window) to the generator as exclusions', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([
      seedRow({ forDate: '2026-06-10', difficulty: 'beginner', word: 'recent-word' }),
      seedRow({ forDate: '2026-01-01', difficulty: 'beginner', word: 'ancient-word' }),
    ])

    const generator = new CountingGenerator(allFourGenerated())
    await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))

    expect(generator.lastExclusions).toContain('recent-word')
    expect(generator.lastExclusions).not.toContain('ancient-word')
  })

  it('retries generation when a word repeats a recent one, then persists the clean set', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([
      seedRow({ forDate: '2026-06-10', difficulty: 'beginner', word: 'recent-word' }),
    ])

    const colliding = DIFFICULTIES.map((difficulty) =>
      generatedWord({ difficulty, word: difficulty === 'beginner' ? 'Recent-Word' : `${difficulty}-word` }),
    )
    const generator = new ScriptedGenerator([colliding, allFourGenerated()])
    await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))

    expect(generator.calls).toBe(2)
    const persisted = await store.getWordsForDate('2026-07-05')
    expect(persisted.map((w) => w.word).sort()).toEqual(
      DIFFICULTIES.map((d) => `${d}-word`).sort(),
    )
  })

  it('retries when a word repeats within the same batch (cross-difficulty duplicate)', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    const dupBatch = DIFFICULTIES.map((difficulty) => generatedWord({ difficulty, word: 'same' }))
    const generator = new ScriptedGenerator([dupBatch, allFourGenerated()])

    await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))
    expect(generator.calls).toBe(2)
  })

  it('accepts a repeat after exhausting retries rather than blocking the user', async () => {
    const store = new DrizzleWotdStore(await freshTestDb(wotdSchema, migrations))
    await store.insertWords([
      seedRow({ forDate: '2026-06-10', difficulty: 'beginner', word: 'recent-word' }),
    ])

    const alwaysColliding = DIFFICULTIES.map((difficulty) =>
      generatedWord({ difficulty, word: difficulty === 'beginner' ? 'recent-word' : `${difficulty}-word` }),
    )
    const generator = new ScriptedGenerator([alwaysColliding])
    const result = await new GetTodayWordsHandler(generator).run(undefined, makeCtx(store))

    expect(generator.calls).toBe(3)
    expect(result).toHaveLength(4)
    const persisted = await store.getWordsForDate('2026-07-05')
    expect(persisted.find((w) => w.difficulty === 'beginner')?.word).toBe('recent-word')
  })

  it('throws when the re-select after generation is still incomplete', async () => {
    // Hand-written fake: insertWords is a no-op, getWordsForDate always returns
    // an incomplete set — simulates generation succeeding but persistence
    // silently failing to fill every difficulty.
    class NeverPersistsStore implements WotdStore {
      getWordsForDate(): Promise<WordRow[]> {
        return Promise.resolve([])
      }
      getRecentWords(): Promise<string[]> {
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
