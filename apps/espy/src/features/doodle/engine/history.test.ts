import { describe, expect, it } from 'vitest'

import { History, currentViewBox, visibleOps } from './history.ts'
import type { Blot, Eye, Op, Stroke, ViewBox } from './types.ts'

const vbA: ViewBox = { width: 100, height: 100 }
const vbB: ViewBox = { width: 200, height: 150 }

function blot(): Blot {
  return { cx: 10, cy: 10, r: 5, points: [{ x: 0, y: 0 }], satellites: [] }
}
function fieldOp(vb: ViewBox, blots: Blot[] = [blot()]): Op {
  return { type: 'field', viewBox: vb, blots }
}
function strokeOp(): Op {
  const stroke: Stroke = { color: '#171717', width: 3.4, points: [{ x: 1, y: 1 }] }
  return { type: 'stroke', stroke }
}
function eyeOp(): Op {
  const eye: Eye = { x: 5, y: 5, size: 12, pupilAngle: 0 }
  return { type: 'eye', eye }
}

describe('History — undo floor', () => {
  it('starts at the initial field with canUndo === false', () => {
    const h = new History([fieldOp(vbA)])
    expect(h.ops).toHaveLength(1)
    expect(h.ops[0]?.type).toBe('field')
    expect(h.canUndo).toBe(false)
  })

  it('undo() at the floor is a no-op — length stays 1', () => {
    const h = new History([fieldOp(vbA)])
    h.undo()
    expect(h.ops).toHaveLength(1)
    expect(h.canUndo).toBe(false)
  })
})

describe('History — push / undo / counts', () => {
  it('counts strokes and eyes and undo removes the last op', () => {
    const h = new History([fieldOp(vbA)])
    h.push(strokeOp())
    h.push(eyeOp())
    expect(h.canUndo).toBe(true)
    expect(h.counts()).toEqual({ fields: 1, blots: 1, strokes: 1, eyes: 1 })

    h.undo() // removes the eye
    expect(h.counts()).toEqual({ fields: 1, blots: 1, strokes: 1, eyes: 0 })
  })
})

describe('History — New page is undoable', () => {
  it('pushing a second field then undoing restores the previous field and its trailing ops', () => {
    const h = new History([fieldOp(vbA)])
    h.push(strokeOp())
    h.push(eyeOp())

    // New page
    h.push(fieldOp(vbB))
    expect(currentViewBox(h.ops)).toEqual(vbB)
    // Only the fresh field is visible; the earlier segment is cleared but retained.
    expect(visibleOps(h.ops)).toHaveLength(1)
    expect(visibleOps(h.ops)[0]).toEqual(fieldOp(vbB))

    // Undo the New page — earlier field + trailing stroke/eye become visible again.
    h.undo()
    expect(currentViewBox(h.ops)).toEqual(vbA)
    const visible = visibleOps(h.ops)
    expect(visible).toHaveLength(3)
    expect(visible[0]?.type).toBe('field')
    expect(visible[1]?.type).toBe('stroke')
    expect(visible[2]?.type).toBe('eye')
  })
})

describe('visibleOps / currentViewBox', () => {
  it('returns the last field op and everything after it, never ops before it', () => {
    const ops: Op[] = [fieldOp(vbA), strokeOp(), fieldOp(vbB), eyeOp()]
    const visible = visibleOps(ops)
    expect(visible).toHaveLength(2)
    expect(visible[0]).toEqual(fieldOp(vbB))
    expect(visible[1]?.type).toBe('eye')
    expect(visible).not.toContain(ops[0])
    expect(visible).not.toContain(ops[1])
  })

  it('currentViewBox returns the last field viewBox', () => {
    const ops: Op[] = [fieldOp(vbA), strokeOp(), fieldOp(vbB), eyeOp()]
    expect(currentViewBox(ops)).toEqual(vbB)
  })
})
