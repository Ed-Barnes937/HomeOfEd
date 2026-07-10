/**
 * Session restore — single slot, holds only the *current* drawing (spec §10).
 * Never throws: garbage/missing/malformed input always falls back to `null`
 * so the hook can generate a fresh field.
 */

import type { Blot, Eye, Op, Point, Satellite, Stroke, ViewBox } from './engine/types.ts'

const KEY = 'espy:doodle:v1'

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return isNumber(p.x) && isNumber(p.y)
}

function isPointArray(value: unknown): value is Point[] {
  return Array.isArray(value) && value.every(isPoint)
}

function isSatellite(value: unknown): value is Satellite {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return isNumber(s.x) && isNumber(s.y) && isNumber(s.r)
}

function isViewBox(value: unknown): value is ViewBox {
  if (typeof value !== 'object' || value === null) return false
  const vb = value as Record<string, unknown>
  return isNumber(vb.width) && isNumber(vb.height)
}

function isBlot(value: unknown): value is Blot {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return (
    isNumber(b.cx) &&
    isNumber(b.cy) &&
    isNumber(b.r) &&
    isPointArray(b.points) &&
    Array.isArray(b.satellites) &&
    b.satellites.every(isSatellite)
  )
}

function isStroke(value: unknown): value is Stroke {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    isString(s.color) && isNumber(s.width) && isPointArray(s.points) && s.points.length >= 1
  )
}

function isEye(value: unknown): value is Eye {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return isNumber(e.x) && isNumber(e.y) && isNumber(e.size) && isNumber(e.pupilAngle)
}

function isOp(value: unknown): value is Op {
  if (typeof value !== 'object' || value === null) return false
  const op = value as Record<string, unknown>
  switch (op.type) {
    case 'field':
      return (
        isViewBox(op.viewBox) &&
        Array.isArray(op.blots) &&
        op.blots.every(isBlot) &&
        (op.baked === undefined || isString(op.baked))
      )
    case 'stroke':
      return isStroke(op.stroke)
    case 'eye':
      return isEye(op.eye)
    default:
      return false
  }
}

function isOpArray(value: unknown): value is Op[] {
  return Array.isArray(value) && value.every(isOp)
}

/** Drop the baked raster from every field op except the current (last) one — the
 * only field whose bitmap the restore needs; older ones fall back to plain blots. */
function stripOldBaked(ops: readonly Op[]): Op[] {
  let lastField = -1
  ops.forEach((op, i) => {
    if (op.type === 'field') lastField = i
  })
  return ops.map((op, i) =>
    op.type === 'field' && i !== lastField && op.baked !== undefined
      ? { ...op, baked: undefined }
      : op,
  )
}

export function saveSession(ops: readonly Op[], storage: Pick<Storage, 'setItem'>): void {
  try {
    storage.setItem(KEY, JSON.stringify(ops))
    return
  } catch {
    // Over quota (many baked fields pile up in the undo history) — retry with
    // only the current field's raster.
  }
  try {
    storage.setItem(KEY, JSON.stringify(stripOldBaked(ops)))
  } catch {
    // Still failing (quota or storage unavailable) — drop the save rather than
    // throw; an accidental reload just regenerates the field.
  }
}

export function loadSession(storage: Pick<Storage, 'getItem'>): Op[] | null {
  let raw: string | null
  try {
    raw = storage.getItem(KEY)
  } catch {
    return null // storage unavailable (e.g. disabled) — start fresh
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  return isOpArray(parsed) ? parsed : null
}
