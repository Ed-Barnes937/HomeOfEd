// Where the EARNED popover opens (discovery-tree ticket 13). Pure arithmetic,
// kept beside the component that measures for it: a rectangle in, a `fixed`
// offset out, so the flip and the clamps are vitest cases rather than something
// only a browser can tell you about.
//
// This is EarnedElements' own positioning and nothing else's - the scenes
// popover anchors itself, and one shared popover framework is not what two
// call sites are asking for.

/**
 * The box the popover opens against, in viewport coordinates. Its two axes come
 * from different elements, which is the whole of the ticket's design: the rail
 * horizontally (the popover opens clear of the column, not inside its trailing
 * padding) and the control vertically (the thing the player clicked).
 */
export interface AnchorRect {
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

export interface AnchorSize {
  readonly width: number
  readonly height: number
}

export interface AnchorPlacement {
  readonly top: number
  readonly left: number
}

/** The gap between the anchor box and the popover beside it. */
export const ANCHOR_GAP = 8

/** How close to the viewport's edge the popover is ever allowed to sit. */
export const VIEWPORT_MARGIN = 8

/**
 * Opens the popover beside the anchor box and top-aligned with it, then keeps
 * it on screen: it flips to the anchor's other side when the preferred side has
 * no room, and clamps within the viewport's margins otherwise. In practice the
 * clamp that bites is the vertical one, because the control lives down the
 * rail rather than at its head.
 *
 * The clamps are applied low-edge-last, so a popover larger than the viewport
 * pins to the top/left margin rather than being pushed off the opposite side.
 */
export function anchorPopover(
  anchor: AnchorRect,
  popover: AnchorSize,
  viewport: AnchorSize,
): AnchorPlacement {
  const beside = anchor.right + ANCHOR_GAP
  const fitsBeside = beside + popover.width <= viewport.width - VIEWPORT_MARGIN
  const left = fitsBeside ? beside : anchor.left - ANCHOR_GAP - popover.width

  return {
    top: clamp(anchor.top, popover.height, viewport.height),
    left: clamp(left, popover.width, viewport.width),
  }
}

function clamp(offset: number, extent: number, available: number): number {
  return Math.max(VIEWPORT_MARGIN, Math.min(offset, available - VIEWPORT_MARGIN - extent))
}
