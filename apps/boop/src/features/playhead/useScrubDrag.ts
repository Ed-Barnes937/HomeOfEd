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
 * A pointer gesture on a scrub track (boop-playhead ticket 05, spec §4): the
 * press scrubs where it landed and every move while held scrubs again, so a tap
 * and a drag are the same gesture at different lengths.
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
export function useScrubDrag(onScrub: (point: ScrubPoint) => void): ScrubDrag {
  const dragging = useRef<number | null>(null)

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

  const release = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragging.current === event.pointerId) dragging.current = null
  }

  return {
    onPointerDown: (event) => {
      // Captured to the track, so a drag that wanders off the strip keeps
      // scrubbing rather than stranding the playhead mid-gesture.
      event.currentTarget.setPointerCapture(event.pointerId)
      dragging.current = event.pointerId
      scrub(event)
    },
    onPointerMove: (event) => {
      if (dragging.current === event.pointerId) scrub(event)
    },
    onPointerUp: release,
    onPointerCancel: release,
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
