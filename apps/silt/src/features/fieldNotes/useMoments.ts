/**
 * The moments' timing (spec §6). `moments.ts` decides *what* is worth showing;
 * this decides *when*, which is the only part that needs React: one card at a
 * time, rise, hold, fade, next.
 *
 * It watches the derived view rather than the sim's report, so a card cannot
 * disagree with the chip beside it - both are reading the same store, one
 * render apart. The page has no second path to keep in step: subscribe the sim
 * to `witness`, and the cards follow.
 */
import { useEffect, useRef, useState } from 'react'

import type { FieldNotesView } from './fieldNotesView.ts'
import {
  advanceCompletion,
  completionAtBoot,
  dismissCompletion,
  isComplete,
  momentsFor,
  queueMoments,
  type Moment,
} from './moments.ts'

/** The card's entrance, matching `fnRise` in the stylesheet (spec §6). */
export const RISE_MS = 400

/** How long a card stays once it has arrived. */
export const HOLD_MS = 2500

/** And how long it takes to go. */
export const FADE_MS = 400

export interface Moments {
  /** The card on screen, or `null` when the world is quiet. */
  card: Moment | null
  /** The card's last beat: it is fading, and the next one is behind it. */
  leaving: boolean
  /** The one-time line for a chart that has just been finished. */
  completing: boolean
}

/** Field notes' moments, driven by the view the rest of the page renders. */
export function useMoments(view: FieldNotesView): Moments {
  const [queue, setQueue] = useState<readonly Moment[]>([])
  const [leaving, setLeaving] = useState(false)
  const [completion, setCompletion] = useState(() => completionAtBoot(isComplete(view)))
  // The view the last diff was taken against. Written from an effect, never
  // during render - a card is a side effect of progress moving, and under
  // StrictMode's double invocation a render-phase write would swallow it.
  const previous = useRef(view)

  useEffect(() => {
    const before = previous.current
    previous.current = view
    const arriving = momentsFor(before, view)
    if (arriving.length > 0) setQueue((current) => queueMoments(current, arriving))
    setCompletion((current) => advanceCompletion(current, isComplete(view)))
  }, [view])

  const card = queue[0] ?? null

  // Keyed on the card itself, so a queue that grows behind it never restarts
  // the one on screen.
  useEffect(() => {
    if (!card) return
    const fade = setTimeout(() => setLeaving(true), RISE_MS + HOLD_MS)
    const next = setTimeout(
      () => {
        setLeaving(false)
        setQueue((current) => current.slice(1))
      },
      RISE_MS + HOLD_MS + FADE_MS,
    )
    return () => {
      clearTimeout(fade)
      clearTimeout(next)
    }
  }, [card])

  useEffect(() => {
    if (!completion.showing) return
    const timer = setTimeout(() => setCompletion(dismissCompletion), RISE_MS + HOLD_MS + FADE_MS)
    return () => clearTimeout(timer)
  }, [completion.showing])

  return { card, leaving, completing: completion.showing }
}
