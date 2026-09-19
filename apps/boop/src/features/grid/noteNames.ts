import { laneNoteMidi } from '../../engine/pitch.ts'
import { PITCHES_PER_LANE, type PitchedConfig } from '../../engine/sequencerEngine.ts'

/**
 * What the lane's gutter prints beside each cell (spec §7): letter names, no
 * octave, so a child can read a song off a page. A lookup keyed by pitch index,
 * the shape `solfege.ts` already has - a second scheme is another array, not
 * another layout.
 *
 * Every name comes out of `pitch.ts`'s ladder, so the key is the manifest's to
 * choose and never this file's: re-root an instrument and its names follow.
 */

/** The seven letters, and how far each sits above the C below it. */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

/**
 * How a tonic of each pitch class is conventionally spelled - its letter, and
 * its accidental. The flat side wins where a key has a choice (Db over C#), as
 * songbooks write it; F# over Gb at the six-a-side tie.
 */
const TONIC_SPELLING: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, -1],
  [1, 0],
  [2, -1],
  [2, 0],
  [3, 0],
  [3, 1],
  [4, 0],
  [5, -1],
  [5, 0],
  [6, -1],
  [6, 0],
]

/** The lane's eight names, low note first - index 0 is do, index 7 the high do. */
export function laneNoteNames(pitched: PitchedConfig): readonly string[] {
  const [tonicLetter] = TONIC_SPELLING[pitchClass(laneNoteMidi(pitched, 0))]!
  return Array.from({ length: PITCHES_PER_LANE }, (_, pitchIndex) => {
    // A major scale walks the letters one at a time, whatever its accidentals
    // are, so the degree picks the letter and the ladder picks the sign.
    const letter = (tonicLetter + pitchIndex) % LETTERS.length
    const alteration = signedInterval(pitchClass(laneNoteMidi(pitched, pitchIndex)), letter)
    return `${LETTERS[letter]}${alteration < 0 ? 'b'.repeat(-alteration) : '#'.repeat(alteration)}`
  })
}

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

/** How far the pitch class sits off that letter's natural, as -6..5 semitones. */
function signedInterval(target: number, letter: number): number {
  return ((((target - LETTER_SEMITONES[letter]!) % 12) + 18) % 12) - 6
}
