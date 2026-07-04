import { clampParams, DEFAULT_PARAMS, type SimParams } from './engine/params.ts'
import type { BoidShape } from './render/renderer.ts'

export type ThemeId = 'neon' | 'retro' | 'asteroids' | 'autumnal' | 'space' | 'duckSeason'

export interface Settings {
  theme: ThemeId
  shape: BoidShape
  params: SimParams
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'neon',
  shape: 'triangle',
  params: DEFAULT_PARAMS,
}

const STORAGE_KEY = 'boids:settings:v1'
const THEME_IDS: readonly ThemeId[] = [
  'neon',
  'retro',
  'asteroids',
  'autumnal',
  'space',
  'duckSeason',
]
const SHAPES: readonly BoidShape[] = ['triangle', 'dot', 'line', 'rocket', 'duck']

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}

function isShape(value: unknown): value is BoidShape {
  return typeof value === 'string' && (SHAPES as readonly string[]).includes(value)
}

/** Minimal read/write surface — the caller passes `window.localStorage`. */
type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Merge whatever's stored over the defaults key-by-key and clamp each field;
 * garbage, missing, or unknown keys fall back to the default. Never throws.
 */
export function loadSettings(storage: SettingsStorage): Settings {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_SETTINGS

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_SETTINGS
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS

  const record = parsed as Record<string, unknown>
  return {
    theme: isThemeId(record.theme) ? record.theme : DEFAULT_SETTINGS.theme,
    shape: isShape(record.shape) ? record.shape : DEFAULT_SETTINGS.shape,
    params: clampParams(record.params ?? {}),
  }
}

export function saveSettings(settings: Settings, storage: SettingsStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
