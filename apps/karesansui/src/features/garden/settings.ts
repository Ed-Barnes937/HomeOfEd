import type { GardenConfig } from './engine/state.ts'

export interface Preset {
  name: string
  ring: number
  wheels: number[]
  offset: number
  speed: number
}

const STORAGE_KEY = 'karesansui:presets:v2'
const LEGACY_KEY = 'karesansui:presets:v1'
const MAX_PRESETS = 8

/** Minimal read/write surface — the caller passes `window.localStorage`. */
type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number')
}

/**
 * A stored entry is usable if it carries the v2 fields. v1 entries also pass —
 * they just carry extra `rake`/`turns` that migration drops (plan 0008 D11).
 */
function hasPresetFields(value: unknown): value is Preset {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    typeof record.ring === 'number' &&
    isNumberArray(record.wheels) &&
    typeof record.offset === 'number' &&
    typeof record.speed === 'number'
  )
}

/** Strip any legacy fields down to the v2 shape. */
function toV2(entry: Preset): Preset {
  return {
    name: entry.name,
    ring: entry.ring,
    wheels: entry.wheels,
    offset: entry.offset,
    speed: entry.speed,
  }
}

function parseArray(raw: string | null): unknown[] | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  return Array.isArray(parsed) ? parsed : null
}

/**
 * Load presets, migrating v1 → v2 on first read. Reads v2 if present; otherwise
 * maps any valid v1 entries into v2 (dropping `rake`/`turns`), writes them under
 * the v2 key, and returns them. Garbage / missing keys fall back to `[]`. Never
 * throws.
 */
export function loadPresets(storage: PresetStorage): Preset[] {
  const v2 = parseArray(storage.getItem(STORAGE_KEY))
  if (v2) return v2.filter(hasPresetFields).map(toV2)

  const v1 = parseArray(storage.getItem(LEGACY_KEY))
  if (!v1) return []
  const migrated = v1.filter(hasPresetFields).map(toV2)
  storage.setItem(STORAGE_KEY, JSON.stringify(migrated))
  return migrated
}

/** `${ring} · ${wheels.join('·')}` — the ring and its cog train. */
export function presetName(config: GardenConfig): string {
  return `${config.ring} · ${config.wheels.join('·')}`
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
    speed: config.speed,
  }
  const next = [...presets, preset].slice(-MAX_PRESETS)
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** Rename the preset at `index` (blank names are ignored), persist, return the next array. */
export function renamePreset(
  index: number,
  name: string,
  presets: Preset[],
  storage: PresetStorage,
): Preset[] {
  const trimmed = name.trim()
  if (!trimmed) return presets
  const next = presets.map((p, i) => (i === index ? { ...p, name: trimmed } : p))
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

/** Remove the preset at `index`, persist, return the next array. */
export function deletePreset(index: number, presets: Preset[], storage: PresetStorage): Preset[] {
  const next = presets.filter((_, i) => i !== index)
  storage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
