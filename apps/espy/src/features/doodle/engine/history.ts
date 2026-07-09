/**
 * Command-replay history (spec §3.2). The drawing is an ordered list of
 * immutable `Op`s; the canvas is a projection of that list. Undo pops the last
 * op; rendering replays. PURE TS — no DOM/Canvas.
 *
 * Invariants:
 * - Index 0 is ALWAYS a `field` (the initial field) — the undo floor. You can
 *   never undo into blank paper (decision Q4.3).
 * - `undo()` when only the initial field remains is a no-op.
 * - "New page" = pushing another `field`; it is fully undoable (decision Q4.2).
 */
import type { Op, ViewBox } from './types.ts'

export class History {
  private _ops: Op[]

  constructor(initial: Op[] = []) {
    this._ops = [...initial]
  }

  get ops(): readonly Op[] {
    return this._ops
  }

  push(op: Op): void {
    this._ops.push(op)
  }

  /** Pops the last op; NO-OP if only the initial field remains (the floor). */
  undo(): void {
    if (this.canUndo) this._ops.pop()
  }

  /** True unless we're at the undo floor (only the initial field remains). */
  get canUndo(): boolean {
    return this._ops.length > 1
  }

  counts(): { fields: number; blots: number; strokes: number; eyes: number } {
    let fields = 0
    let blots = 0
    let strokes = 0
    let eyes = 0
    for (const op of this._ops) {
      if (op.type === 'field') {
        fields++
        blots += op.blots.length
      } else if (op.type === 'stroke') {
        strokes++
      } else {
        eyes++
      }
    }
    return { fields, blots, strokes, eyes }
  }
}

/** Index of the last `field` op — the one that currently clears the canvas. */
function lastFieldIndex(ops: readonly Op[]): number {
  for (let i = ops.length - 1; i >= 0; i--) {
    if (ops[i]?.type === 'field') return i
  }
  return -1
}

/**
 * The currently-VISIBLE ops: the last `field` op and everything after it.
 * A field clears the canvas, so ops before the last field are not drawn — but
 * they stay in history so undoing a field restores the previous drawing.
 */
export function visibleOps(ops: readonly Op[]): Op[] {
  const i = lastFieldIndex(ops)
  return i < 0 ? [] : ops.slice(i)
}

/** Logical space the visible drawing lives in = the last field's viewBox. */
export function currentViewBox(ops: readonly Op[]): ViewBox {
  const i = lastFieldIndex(ops)
  const op = ops[i]
  if (op?.type !== 'field') {
    throw new Error('currentViewBox: history has no field op')
  }
  return op.viewBox
}
