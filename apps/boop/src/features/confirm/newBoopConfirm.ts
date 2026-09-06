/**
 * The New boop keep-card (boop-clips ticket 03): its copy, and the one
 * question that decides whether it is raised at all.
 *
 * "New boop" is the only action besides the clip header's own delete that
 * destroys a clip (ADR 0056 §2), and a child losing what they made is the
 * feel-bad the whole app is arranged to avoid. So the reset asks first - as two
 * labelled choices a 6-year-old can read, never prose and never the browser's
 * own confirm (ADR 0031 §2 rules that out, and still does).
 */

import { isUnsaved, type LoadedBoop } from '../../savedState.ts'
import type { Song } from '../../song/song.ts'

/**
 * The card's words. `ConfirmCard`'s shape, like the clear-grid and delete-boop
 * confirms: title, one line of consequence, safe choice left, destructive
 * right. "Save it" is the safe one because nothing is lost by taking it.
 */
export const NEW_BOOP_CONFIRM = {
  title: 'Keep this boop?',
  message: 'Save it to My boops, or start fresh and lose it.',
  safeLabel: 'Save it',
  destructiveLabel: 'Start fresh',
} as const

/**
 * Is there anything in this song a child would miss? A second clip, a
 * placement, or one painted step is enough. A one-clip song with nothing in it
 * is what the reset *makes*, so resetting it destroys nothing and the card
 * would be asking about an empty screen - which is how tapping New boop twice
 * in a row would otherwise read.
 *
 * Deliberately not "differs from a fresh boop in any way": a speed nudge or a
 * clip rename on an otherwise empty grid is an edit (ADR 0031, as amended) but
 * not something to interrupt a child over.
 */
function hasSomethingToKeep(song: Song): boolean {
  return (
    song.clips.length > 1 ||
    song.placements.some((clipIndices) => clipIndices.length > 0) ||
    song.clips.some((clip) => clip.pattern.some((row) => row.steps.includes(true)))
  )
}

/**
 * Would the reset really take something away? Only then is the card raised
 * (ticket 03): the boop has to be missing from "My boops" or drifted from the
 * row it came from - `savedState.ts`'s own question - *and* have something in
 * it. A boop that still matches its saved row is one tap from coming back, so
 * the reset just runs.
 */
export function wouldLoseWork(loaded: LoadedBoop | null, song: Song): boolean {
  return isUnsaved(loaded) && hasSomethingToKeep(song)
}
