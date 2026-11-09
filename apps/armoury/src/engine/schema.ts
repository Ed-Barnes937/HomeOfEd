// Item-agnostic: a schema describes an item type's parameters, and these
// helpers fill, clamp, validate and randomise them. Nothing here knows about wands.

export type ParamValue = number | string
export type Params = Record<string, ParamValue>

interface BaseParam {
  key: string
  label: string
  group: string
  /** Hide the control when it has no effect, e.g. twist when there's no carving. */
  visible?: (p: Params) => boolean
}

export interface NumberParam extends BaseParam {
  kind: 'number'
  min: number
  max: number
  step: number
  default: number
  /** Words for the two ends of the slider, in kid language. */
  ends?: [string, string]
}

export interface ChoiceOption {
  value: string
  label: string
  swatch?: string
  /** How often randomise picks this option relative to the others; 1 if unset. */
  weight?: number
}

export interface ChoiceParam extends BaseParam {
  kind: 'choice'
  options: ChoiceOption[]
  default: string
  /** Restrict options based on other params. The first allowed option is the fallback. */
  allowed?: (p: Params) => string[]
}

export type ParamDef = NumberParam | ChoiceParam

export interface ItemSchema {
  itemType: string
  groups: { key: string; label: string }[]
  params: ParamDef[]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function snap(n: number, def: NumberParam): number {
  const snapped = Math.round((n - def.min) / def.step) * def.step + def.min
  return Number(clamp(snapped, def.min, def.max).toFixed(6))
}

export function defaults(schema: ItemSchema): Params {
  return normalise(schema, {})
}

/** Turns anything (a decoded link, a preset, a half-filled object) into valid params. */
export function normalise(schema: ItemSchema, raw: Record<string, unknown>): Params {
  const out: Params = {}
  for (const def of schema.params) {
    const v = raw[def.key]
    if (def.kind === 'number') {
      out[def.key] = typeof v === 'number' && Number.isFinite(v) ? snap(v, def) : def.default
    } else {
      out[def.key] =
        typeof v === 'string' && def.options.some((o) => o.value === v) ? v : def.default
    }
  }
  // A second pass, because allowed() reads other params.
  for (const def of schema.params) {
    if (def.kind === 'choice' && def.allowed) {
      const allowed = def.allowed(out)
      if (!allowed.includes(out[def.key] as string)) out[def.key] = allowed[0] ?? def.default
    }
  }
  return out
}

export interface RandomiseOptions {
  /** The params a locked group keeps. */
  keep: Params
  locked: readonly string[]
}

export function randomise(
  schema: ItemSchema,
  rng: () => number,
  options?: RandomiseOptions,
): Params {
  const pick = (options: readonly ChoiceOption[]): string => {
    const weight = (o: ChoiceOption) => o.weight ?? 1
    let x = rng() * options.reduce((sum, o) => sum + weight(o), 0)
    for (const o of options) {
      x -= weight(o)
      if (x < 0) return o.value
    }
    return options[options.length - 1]!.value
  }
  const isLocked = (def: ParamDef) => options?.locked.includes(def.group) ?? false
  const raw: Params = {}
  for (const def of schema.params) {
    if (isLocked(def)) raw[def.key] = options!.keep[def.key] ?? def.default
    else if (def.kind === 'number') raw[def.key] = def.min + rng() * (def.max - def.min)
    else raw[def.key] = pick(def.options)
  }
  for (const def of schema.params) {
    if (def.kind === 'choice' && def.allowed && !isLocked(def))
      raw[def.key] = pick(allowedOptions(def, raw))
  }
  return normalise(schema, raw)
}

export function isVisible(def: ParamDef, p: Params): boolean {
  return def.visible ? def.visible(p) : true
}

export function allowedOptions(def: ChoiceParam, p: Params): ChoiceOption[] {
  if (!def.allowed) return def.options
  const allowed = def.allowed(p)
  return def.options.filter((o) => allowed.includes(o.value))
}

/** Small, fast, seedable PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
