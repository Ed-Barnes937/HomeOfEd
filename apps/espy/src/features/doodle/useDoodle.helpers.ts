/**
 * Pure glue for the `useDoodle` hook (spec §8) — extracted so it can be
 * unit-tested in the node vitest env without React/DOM. No React, no Canvas.
 */
import { generateField } from './engine/field.ts'
import type { Op, Rng } from './engine/types.ts'

export interface InitialOps {
  ops: Op[]
  /** Whether the initial render should bloom in (fresh field) or not (restore). */
  bloom: boolean
}

/**
 * Restore-or-generate decision (spec §8 "Mount"). A restored session must be a
 * non-empty `Op[]` whose first op is a `field` (the undo floor / viewBox
 * anchor); anything else generates a fresh field for the current CSS size.
 * Restore does NOT bloom; a freshly generated field does.
 */
export function initialOps(loaded: Op[] | null, css: { w: number; h: number }, rng: Rng): InitialOps {
  if (loaded && loaded.length > 0 && loaded[0]?.type === 'field') {
    return { ops: loaded, bloom: false }
  }
  const viewBox = { width: css.w, height: css.h }
  return {
    ops: [{ type: 'field', viewBox, blots: generateField(viewBox, rng) }],
    bloom: true,
  }
}
