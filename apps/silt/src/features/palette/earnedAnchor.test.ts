import { describe, expect, it } from 'vitest'

import { ANCHOR_GAP, VIEWPORT_MARGIN, anchorPopover } from './earnedAnchor.ts'

// The rail's right edge, and the control's own band down it, on a 1200x800
// desktop viewport.
const anchor = { top: 700, left: 0, right: 184, bottom: 736 }
const popover = { width: 230, height: 300 }
const viewport = { width: 1200, height: 800 }

describe('anchorPopover', () => {
  it('opens beside the anchor, top-aligned with it', () => {
    const roomy = { ...anchor, top: 100, bottom: 136 }

    expect(anchorPopover(roomy, popover, viewport)).toEqual({
      top: 100,
      left: 184 + ANCHOR_GAP,
    })
  })

  // The bug this ticket exists for, in reverse: the control sits well down the
  // rail, so a top-aligned box would hang off the bottom of the screen.
  it('clamps upward when the control sits low in the rail', () => {
    const placed = anchorPopover(anchor, popover, viewport)

    expect(placed.left).toBe(184 + ANCHOR_GAP)
    expect(placed.top).toBe(800 - VIEWPORT_MARGIN - 300)
    expect(placed.top + popover.height).toBeLessThanOrEqual(viewport.height)
  })

  it('flips to the other side of the anchor when there is no room beside it', () => {
    const nearTheRightEdge = { ...anchor, left: 900, right: 1052 }

    expect(anchorPopover(nearTheRightEdge, popover, viewport).left).toBe(900 - ANCHOR_GAP - 230)
  })

  // The rail is hard against the left edge, so a flip has nowhere to go:
  // staying on screen wins over staying clear of the rail.
  it('clamps to the margin rather than going off screen when neither side fits', () => {
    const tiny = { width: 300, height: 800 }

    expect(anchorPopover(anchor, popover, tiny).left).toBe(VIEWPORT_MARGIN)
  })

  // 70vh caps the popover in the stylesheet, but a short viewport is still the
  // case where a naive clamp would hand back a negative top.
  it('never places the box above the top margin', () => {
    const short = { width: 1200, height: 200 }

    expect(anchorPopover(anchor, popover, short).top).toBe(VIEWPORT_MARGIN)
  })
})
