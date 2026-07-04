/**
 * The flocking parameters — the design handoff's seven sliders plus `size`
 * (a per-boid render scale) and `cursor`, the bipolar pointer-force slider
 * (negative = repel, positive = attract).
 */
export interface SimParams {
  count: number
  speed: number
  separation: number
  alignment: number
  cohesion: number
  vision: number
  trail: number
  size: number
  cursor: number
}

export interface ParamRange {
  min: number
  max: number
  step: number
}

export const PARAM_RANGES: Record<keyof SimParams, ParamRange> = {
  count: { min: 20, max: 1000, step: 1 },
  speed: { min: 0.5, max: 6, step: 0.1 },
  separation: { min: 0, max: 3, step: 0.05 },
  alignment: { min: 0, max: 3, step: 0.05 },
  cohesion: { min: 0, max: 3, step: 0.05 },
  vision: { min: 20, max: 140, step: 1 },
  trail: { min: 0, max: 1, step: 0.01 },
  size: { min: 0.5, max: 2.5, step: 0.1 },
  cursor: { min: -3, max: 3, step: 0.05 },
}

export const DEFAULT_PARAMS: SimParams = {
  count: 150,
  speed: 2.6,
  separation: 1.3,
  alignment: 1.0,
  cohesion: 0.9,
  vision: 66,
  trail: 0.42,
  size: 1,
  cursor: 0,
}

const PARAM_KEYS = Object.keys(DEFAULT_PARAMS) as (keyof SimParams)[]

function clampParam(key: keyof SimParams, value: unknown): number {
  const range = PARAM_RANGES[key]
  const n = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_PARAMS[key]
  return Math.min(range.max, Math.max(range.min, n))
}

/**
 * Merge `params` over the defaults key-by-key and clamp each — used both for
 * slider input and for validating whatever localStorage hands back. Garbage
 * or unknown keys fall back to the default; extra unknown keys are dropped.
 */
export function clampParams(params: Partial<Record<keyof SimParams, unknown>>): SimParams {
  const result = {} as SimParams
  for (const key of PARAM_KEYS) {
    result[key] = clampParam(key, params[key])
  }
  return result
}
