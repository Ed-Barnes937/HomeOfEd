import { describe, expect, it } from 'vitest'

import { buildUserMessage, parseGeneratedWords } from './anthropicWordGenerator.ts'

function rawEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    difficulty: 'beginner',
    word: 'happy',
    definition: 'feeling or showing pleasure',
    example_sentence: 'She felt happy.',
    synonyms: ['glad', 'cheerful', 'joyful'],
    ...overrides,
  }
}

function validPayload() {
  return {
    words: [
      rawEntry({ difficulty: 'beginner', word: 'happy' }),
      rawEntry({ difficulty: 'intermediate', word: 'curious' }),
      rawEntry({ difficulty: 'advanced', word: 'resilient' }),
      rawEntry({ difficulty: 'expert', word: 'ephemeral' }),
    ],
  }
}

describe('buildUserMessage', () => {
  it('lists the difficulty personas', () => {
    const message = buildUserMessage([])
    expect(message).toContain('beginner')
    expect(message).toContain('expert')
  })

  it('appends an exclusion clause naming each recent word when the list is non-empty', () => {
    const message = buildUserMessage(['happy', 'curious'])
    expect(message).toContain('happy')
    expect(message).toContain('curious')
    expect(message.toLowerCase()).toContain('do not')
  })

  it('omits the exclusion clause when there are no recent words', () => {
    expect(buildUserMessage([]).toLowerCase()).not.toContain('do not')
  })
})

describe('parseGeneratedWords', () => {
  it('maps a valid 4-difficulty payload to GeneratedWord[], normalizing field names', () => {
    const result = parseGeneratedWords(validPayload())

    expect(result).toHaveLength(4)
    const beginner = result.find((w) => w.difficulty === 'beginner')
    expect(beginner).toEqual({
      difficulty: 'beginner',
      word: 'happy',
      definition: 'feeling or showing pleasure',
      exampleSentence: 'She felt happy.',
      synonyms: ['glad', 'cheerful', 'joyful'],
    })
  })

  it('preserves the synonyms array contents', () => {
    const result = parseGeneratedWords(validPayload())
    const expert = result.find((w) => w.difficulty === 'expert')
    expect(expert?.synonyms).toEqual(['glad', 'cheerful', 'joyful'])
  })

  it('throws when a difficulty is missing', () => {
    const payload = {
      words: [
        rawEntry({ difficulty: 'beginner' }),
        rawEntry({ difficulty: 'intermediate' }),
        rawEntry({ difficulty: 'advanced' }),
      ],
    }
    expect(() => parseGeneratedWords(payload)).toThrow()
  })

  it('throws on a duplicate difficulty (5 entries)', () => {
    const payload = {
      words: [
        rawEntry({ difficulty: 'beginner' }),
        rawEntry({ difficulty: 'beginner' }),
        rawEntry({ difficulty: 'intermediate' }),
        rawEntry({ difficulty: 'advanced' }),
        rawEntry({ difficulty: 'expert' }),
      ],
    }
    expect(() => parseGeneratedWords(payload)).toThrow()
  })

  it('throws when the top-level shape is malformed', () => {
    expect(() => parseGeneratedWords({})).toThrow()
    expect(() => parseGeneratedWords(null)).toThrow()
    expect(() => parseGeneratedWords({ words: 'not-an-array' })).toThrow()
  })

  it('throws when an entry has an invalid difficulty or missing field', () => {
    expect(() =>
      parseGeneratedWords({
        words: [
          rawEntry({ difficulty: 'not-a-real-difficulty' }),
          rawEntry({ difficulty: 'intermediate' }),
          rawEntry({ difficulty: 'advanced' }),
          rawEntry({ difficulty: 'expert' }),
        ],
      }),
    ).toThrow()

    expect(() =>
      parseGeneratedWords({
        words: [
          rawEntry({ difficulty: 'beginner', word: undefined }),
          rawEntry({ difficulty: 'intermediate' }),
          rawEntry({ difficulty: 'advanced' }),
          rawEntry({ difficulty: 'expert' }),
        ],
      }),
    ).toThrow()
  })
})
