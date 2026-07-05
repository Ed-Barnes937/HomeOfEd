import Anthropic from '@anthropic-ai/sdk'

import { DIFFICULTIES, type GeneratedWord, type WordGenerator } from './wordGenerator.ts'

export interface AnthropicWordGeneratorOptions {
  apiKey?: string
  model?: string
}

const DEFAULT_MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT =
  "You are an erudite assistant that generates a challenging word of the day for each of the given English speaking proficiency levels. Each word should be at the edge of what you'd expect a person of that level and age to know and should be returned in the given structure"

const DIFFICULTY_PERSONAS = [
  'beginner: a beginner English speaker, typically a toddler',
  'intermediate: an intermediate English speaker, typically a pre-teen',
  'advanced: an advanced English speaker, typically young teenager',
  'expert: an expert English speaker, typically young adult onwards, aged 16+',
]

const GENERATE_WORDS_TOOL: Anthropic.Tool = {
  name: 'generate_words',
  strict: true,
  description: 'Return exactly one generated word per difficulty level.',
  input_schema: {
    type: 'object',
    properties: {
      words: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            difficulty: { type: 'string', enum: DIFFICULTIES },
            word: { type: 'string', description: 'The word being generated' },
            definition: { type: 'string', description: 'The definition of the generated word' },
            example_sentence: {
              type: 'string',
              description: 'A short example sentence using the generated word',
            },
            synonyms: {
              type: 'array',
              items: { type: 'string' },
              description: 'Three synonyms for the generated word',
            },
          },
          required: ['difficulty', 'word', 'definition', 'example_sentence', 'synonyms'],
          additionalProperties: false,
        },
      },
    },
    required: ['words'],
    additionalProperties: false,
  },
}

/** Raw shape expected inside the tool_use block's `input`, before validation. */
type RawWordEntry = {
  difficulty?: unknown
  word?: unknown
  definition?: unknown
  example_sentence?: unknown
  synonyms?: unknown
}

/**
 * Validates and normalizes the model's tool-call input into GeneratedWord[].
 * Enforces exactly one entry per {@link DIFFICULTIES} value — throws on any
 * missing, duplicate, extra, or malformed entry. Never calls the API; pure
 * function so it's fully unit-testable against canned payloads.
 */
export function parseGeneratedWords(toolInput: unknown): GeneratedWord[] {
  if (typeof toolInput !== 'object' || toolInput === null || !('words' in toolInput)) {
    throw new Error('generate_words tool input missing "words" array')
  }
  const { words } = toolInput
  if (!Array.isArray(words)) {
    throw new Error('generate_words tool input "words" is not an array')
  }

  const parsed = words.map((entry, i): GeneratedWord => {
    const e = entry as RawWordEntry
    if (
      typeof e !== 'object' ||
      e === null ||
      !DIFFICULTIES.includes(e.difficulty as (typeof DIFFICULTIES)[number]) ||
      typeof e.word !== 'string' ||
      typeof e.definition !== 'string' ||
      typeof e.example_sentence !== 'string' ||
      !Array.isArray(e.synonyms) ||
      !e.synonyms.every((s) => typeof s === 'string')
    ) {
      throw new Error(`generate_words entry ${i} has an invalid shape`)
    }
    return {
      difficulty: e.difficulty as (typeof DIFFICULTIES)[number],
      word: e.word,
      definition: e.definition,
      exampleSentence: e.example_sentence,
      synonyms: e.synonyms,
    }
  })

  for (const difficulty of DIFFICULTIES) {
    const matches = parsed.filter((w) => w.difficulty === difficulty)
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly one word for difficulty "${difficulty}", got ${matches.length}`,
      )
    }
  }
  if (parsed.length !== DIFFICULTIES.length) {
    throw new Error(`expected ${DIFFICULTIES.length} words, got ${parsed.length}`)
  }

  return parsed
}

/**
 * Prod generator: one Anthropic tool-use call producing one word per
 * difficulty. The client is built lazily inside generateDailyWords so a
 * missing API key never crashes boot — only /wotd's lazy generation fails.
 */
export class AnthropicWordGenerator implements WordGenerator {
  // Explicit field assignment, not a parameter property: prod runs the TS source
  // under Node's strip-only mode (ADR 0004), which rejects parameter properties.
  private readonly options: AnthropicWordGeneratorOptions

  constructor(options: AnthropicWordGeneratorOptions) {
    this.options = options
  }

  async generateDailyWords(): Promise<GeneratedWord[]> {
    const client = new Anthropic({ apiKey: this.options.apiKey })
    const model = this.options.model ?? DEFAULT_MODEL

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: DIFFICULTY_PERSONAS.join('\n') }],
      tools: [GENERATE_WORDS_TOOL],
      tool_choice: { type: 'tool', name: 'generate_words' },
    })

    const toolUse = response.content.find((block) => block.type === 'tool_use')
    if (!toolUse) {
      throw new Error('Anthropic response contained no tool_use block')
    }

    return parseGeneratedWords(toolUse.input)
  }
}
