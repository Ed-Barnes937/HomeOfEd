import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

import { fractionInSegment, segmentAt } from './scrubGeometry.ts'

/** Marks a track child as one of its segments — how the gesture finds them to hit-test. */
export const SCRUB_SEGMENT_ATTR = 'data-scrub-segment'

/** Where on the track the pointer is: which segment, and how far across it. */
export interface ScrubPoint {
  segment: number
  fraction: number
}

export interface ScrubDrag {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
}

/**
 * How far a deferred gesture must travel before it is a drag at all, rather
 * than the jitter of a finger holding still on a tap.
 */
const SCRUB_SLOP_PX = 4

export interface ScrubDragOptions {
  /**
   * Whether the press itself scrubs.
   *
   * `true` (the laptop strips): it does, so a tap and a drag are the same
   * gesture at different lengths. Nothing competes for the gesture — those
   * strips are in a pinned bar the page cannot scroll.
   *
   * `false` (the phone bands, ticket 06): the press decides nothing, and the
   * gesture must first *prove* it is a scrub. The bands sit inside ADR 0030's
   * one scrolling region, so a press on one is as likely to start a vertical pan
   * as a scrub, and the proof is that the pointer has travelled further across
   * the band than down it — the continuous-axis form of `useDragPaint`'s
   * "crossing a cell boundary is what proves this is a paint". A vertical pan
   * therefore scrubs nothing even though the browser sends a `pointermove` or
   * two before it claims the gesture and sends `pointercancel`. A press that
   * barely moves is still a tap, and scrubs on release.
   */
  applyOnPointerDown?: boolean
}

/** A gesture in progress, and whether it has earned the right to scrub yet. */
interface Scrubbing {
  pointerId: number
  originX: number
  originY: number
  /** Set once the gesture is committed: from then on every move scrubs. */
  live: boolean
}

/**
 * A pointer gesture on a scrub track (boop-playhead ticket 05, spec §4): a tap
 * scrubs where it landed and every move while held scrubs again, so a tap and a
 * drag are the same gesture at different lengths.
 *
 * Deliberately *not* `useDragPaint`: that hook latches a decision on the cell
 * the press started in and repeats it as the pointer crosses siblings, which is
 * what painting a grid needs. A scrub has no decision to latch and no cell
 * identity — it is a continuous axis, so it captures the pointer to the track
 * and reads a coordinate.
 *
 * Nothing about "was it playing when the drag began" is remembered, and nothing
 * is resumed on release: a scrub never stops playback (spec §2), so playback is
 * still running at release exactly when it was running at the press.
 */
export function useScrubDrag(
  onScrub: (point: ScrubPoint) => void,
  { applyOnPointerDown = true }: ScrubDragOptions = {},
): ScrubDrag {
  const dragging = useRef<Scrubbing | null>(null)

  function scrub(event: ReactPointerEvent<HTMLElement>): void {
    const track = event.currentTarget
    const origin = track.getBoundingClientRect().left
    const segments = [...track.querySelectorAll(`[${SCRUB_SEGMENT_ATTR}]`)].map((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left - origin, width: box.width }
    })
    const x = event.clientX - origin
    const segment = segmentAt(segments, x)
    if (segment === null) return
    onScrub({ segment, fraction: fractionInSegment(segments[segment]!, x) })
  }

  /** How far this gesture has travelled from the press, on each axis. */
  const travel = (gesture: Scrubbing, event: ReactPointerEvent<HTMLElement>) => ({
    dx: Math.abs(event.clientX - gesture.originX),
    dy: Math.abs(event.clientY - gesture.originY),
  })

  return {
    onPointerDown: (event) => {
      // Captured to the track, so a drag that wanders off the strip keeps
      // scrubbing rather than stranding the playhead mid-gesture.
      event.currentTarget.setPointerCapture(event.pointerId)
      dragging.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        live: applyOnPointerDown,
      }
      if (applyOnPointerDown) scrub(event)
    },
    onPointerMove: (event) => {
      const gesture = dragging.current
      if (gesture?.pointerId !== event.pointerId) return
      if (!gesture.live) {
        // Not yet proven a scrub. Sideways *and* further sideways than down is
        // the proof; anything else is on its way to being someone else's
        // gesture, so it moves the playhead nowhere.
        const { dx, dy } = travel(gesture, event)
        if (dx < SCRUB_SLOP_PX || dx <= dy) return
        gesture.live = true
      }
      scrub(event)
    },
    onPointerUp: (event) => {
      const gesture = dragging.current
      if (gesture?.pointerId !== event.pointerId) return
      dragging.current = null
      // A live gesture already scrubbed on its last move, and the release point
      // is that same point. What is left is the deferred *tap*: a press that
      // never travelled far enough to be a drag at all.
      if (gesture.live) return
      const { dx, dy } = travel(gesture, event)
      if (Math.max(dx, dy) <= SCRUB_SLOP_PX) scrub(event)
    },
    // A cancel is the browser taking the gesture — a pan of the scrolling region
    // the phone bands sit in — so it commits nothing.
    onPointerCancel: (event) => {
      if (dragging.current?.pointerId === event.pointerId) dragging.current = null
    },
  }
}

/**
 * The keyboard half of a scrub track (spec §4): Left and Right move one unit —
 * a bar on the song strip, a step on the clip rail — and Home returns to the
 * start of the song, from either track. Shared so the two strips cannot drift
 * apart on which keys they answer; the unit itself is the caller's.
 *
 * Returns whether the key was one of ours, so the caller can leave every other
 * key to the browser.
 */
export function scrubKeyMove(
  key: string,
  { onStep, onSongStart }: { onStep: (delta: number) => void; onSongStart: () => void },
): boolean {
  if (key === 'ArrowLeft') onStep(-1)
  else if (key === 'ArrowRight') onStep(1)
  else if (key === 'Home') onSongStart()
  else return false
  return true
}
