import type { GeneratedWord, WordGenerator } from '../server/wordGenerator.ts'

// Deterministic words for dev (simulator) and .iwft. Dev and CI never hit the
// Anthropic API — fakes over mocks (hard rule 5).
const FAKE_WORDS: readonly GeneratedWord[] = [
  {
    difficulty: 'beginner',
    word: 'happy',
    definition: 'feeling or showing pleasure or contentment',
    exampleSentence: 'She felt happy when she saw the puppy.',
    synonyms: ['glad', 'cheerful', 'joyful'],
    wordType: 'adjective',
    respelling: 'HAP·ee',
  },
  {
    difficulty: 'intermediate',
    word: 'curious',
    definition: 'eager to know or learn something',
    exampleSentence: 'The curious cat explored every corner of the room.',
    synonyms: ['inquisitive', 'interested', 'nosy'],
    wordType: 'adjective',
    respelling: 'KYOOR·ee·uhs',
  },
  {
    difficulty: 'advanced',
    word: 'resilient',
    definition: 'able to recover quickly from difficulties',
    exampleSentence: 'A resilient community rebuilt within a year of the storm.',
    synonyms: ['tough', 'hardy', 'adaptable'],
    wordType: 'adjective',
    respelling: 'rih·ZIL·yuhnt',
  },
  {
    difficulty: 'expert',
    word: 'ephemeral',
    definition: 'lasting for a very short time',
    exampleSentence: 'The ephemeral beauty of the cherry blossom draws crowds each spring.',
    synonyms: ['fleeting', 'transient', 'momentary'],
    wordType: 'adjective',
    respelling: 'ih·FEM·er·uhl',
  },
]

export class FakeWordGenerator implements WordGenerator {
  generateDailyWords(): Promise<GeneratedWord[]> {
    return Promise.resolve(FAKE_WORDS.map((word) => ({ ...word, synonyms: [...word.synonyms] })))
  }
}
