import type { GardenConfig, RakeId } from './engine/state.ts'

export interface Preset {
  name: string
  ring: number
  wheels: number[]
  offset: number
  rake: RakeId
  turns: number
  speed: number
}

const STORAGE_KEY = 'karesansui:presets:v1'
const MAX_PRESETS = 8
const RAKE_IDS: readonly RakeId[] = ['marble', 'wide', 'deep', 'fine']

/** Minimal read/write surface — the caller passes `window.localStorage`. */
type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>

function isRakeId(value: unknown): value is RakeId {
  return typeof value === 'string' && (RAKE_IDS as readonly string[]).includes(value)
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number')
}

function isPreset(value: unknown): value is Preset {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    typeof record.ring === 'number' &&
    isNumberArray(record.wheels) &&
    typeof record.offset === 'number' &&
    isRakeId(record.rake) &&
    typeof record.turns === 'number' &&
    typeof record.speed === 'number'
  )
}

/**
 * Parse whatever's stored, dropping any entry that doesn't validate. Garbage
 * JSON, a non-array top level, or a missing key all fall back to `[]`. Never
 * throws.
 */
export function loadPresets(storage: PresetStorage): Preset[] {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  return parsed.filter(isPreset)
}

/** `${ring}·${wheels.join('·')} ${rake[0].toUpperCase()}` */
export function presetName(config: GardenConfig): string {
  return `${config.ring}·${config.wheels.join('·')} ${config.rake[0]!.toUpperCase()}`
}

/** Append a preset built from `config`, keep the newest 8, persist, return the next array. */
export function savePreset(
  config: GardenConfig,
  presets: Preset[],
  storage: PresetStorage,
): Preset[] {
  const preset: Preset = {
    name: presetName(config),
    ring: config.ring,
    wheels: config.wheels,
    offset: config.offset,
    rake: config.rake,
    turns: config.turns,
    speed: config.speed,
  }
  const next = [...presets, preset].slice(-MAX_PRESETS)
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** Remove the preset at `index`, persist, return the next array. */
export function deletePreset(index: number, presets: Preset[], storage: PresetStorage): Preset[] {
  const next = presets.filter((_, i) => i !== index)
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
