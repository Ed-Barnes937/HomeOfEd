// Pinned contracts shared by the backend and frontend lanes. Both import from
// here; neither redefines these shapes.

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

/** The four levels, in display order. Also the enum values in schema.ts. */
export const DIFFICULTIES = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const satisfies readonly Difficulty[]

/**
 * Wire contract (tRPC `todayWords` output element). camelCase; nothing the client
 * doesn't need — no ids, no dates cross the wire. `synonyms` is the DB's
 * `alternatives` column renamed at the store boundary.
 */
export type WordOfTheDay = {
  difficulty: Difficulty
  word: string
  definition: string
  exampleSentence: string
  synonyms: string[]
  /** e.g. "adjective" — null for rows stored before the redesign (no backfill). */
  wordType: string | null
  /** e.g. "ih·FEM·er·uhl" — null for rows stored before the redesign (no backfill). */
  respelling: string | null
}

/**
 * Wire contract (tRPC `yesterdayWord` output) — the Yesterday strip's data.
 * Null on the wire when yesterday has no word for the requested level.
 */
export type YesterdayWord = {
  word: string
  /** e.g. "noun" — null for rows stored before the redesign (no backfill). */
  wordType: string | null
  definition: string
}

/** Generator contract. `synonyms` is exactly 3. */
export type GeneratedWord = {
  difficulty: Difficulty
  word: string
  definition: string
  exampleSentence: string
  synonyms: string[]
  /** The word's part of speech, e.g. "adjective". */
  wordType: string
  /** Syllable-by-syllable respelling, e.g. "ih·FEM·er·uhl". */
  respelling: string
}

export interface WordGenerator {
  /**
   * Produce one word per difficulty. Validates it got exactly one word per
   * difficulty and throws otherwise — the handler never sees a partial set.
   * `exclusions` are recently-used words the generator should avoid (best
   * effort — the handler enforces non-repetition on top of this).
   */
  generateDailyWords(exclusions: string[]): Promise<GeneratedWord[]>
}
