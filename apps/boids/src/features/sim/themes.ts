import type { BoidShape } from './render/renderer.ts'
import type { ThemeId } from './settings.ts'

/**
 * Extra background treatment layered over the solid `background` fill:
 * a static starfield, or a vertical gradient down to `to`.
 */
export type Backdrop = { kind: 'stars' } | { kind: 'gradient'; to: string }

/**
 * The canvas-facing subset of a theme — literal colours, not CSS custom
 * properties (those live in SCSS and are applied separately via
 * `data-theme`).
 */
export interface Theme {
  id: ThemeId
  name: string
  /** Canvas clear colour each frame. */
  background: string
  /** Boid colours; renderer maps colorIndex % palette.length. */
  palette: string[]
  /** shadowBlur; 0 disables glow. */
  glow: number
  drawMode: 'fill' | 'stroke'
  /** Signature boid shape applied when the theme is picked (still overridable). */
  shape?: BoidShape
  /** Background beyond the flat fill; omitted themes stay a solid `background`. */
  backdrop?: Backdrop
}

/** The four preset themes, verbatim from the design handoff's token table. */
export const THEMES: Record<ThemeId, Theme> = {
  neon: {
    id: 'neon',
    name: 'neon',
    background: '#08080c',
    palette: ['#00e6ff', '#ff2bd6', '#8b5cff'],
    glow: 14,
    drawMode: 'fill',
  },
  retro: {
    id: 'retro',
    name: 'retro',
    background: '#221436',
    palette: ['#ff5d8f', '#ffb03a', '#39d5c6'],
    glow: 9,
    drawMode: 'fill',
  },
  asteroids: {
    id: 'asteroids',
    name: 'asteroids',
    background: '#000000',
    palette: ['#ffffff', '#d9e2ff'],
    glow: 0,
    drawMode: 'stroke',
  },
  autumnal: {
    id: 'autumnal',
    name: 'autumnal',
    background: '#f2ece0',
    palette: ['#b8451f', '#d98a37', '#7c7a3a', '#9c392c'],
    glow: 0,
    drawMode: 'fill',
  },
  space: {
    id: 'space',
    name: 'space',
    background: '#060a18',
    palette: ['#e6ecff', '#ff6b6b', '#ffd166'],
    glow: 8,
    drawMode: 'fill',
    shape: 'rocket',
    backdrop: { kind: 'stars' },
  },
  duckSeason: {
    id: 'duckSeason',
    name: 'duck season',
    background: '#cdeef7',
    palette: ['#f4c542', '#e2913a', '#8a5a2b'],
    glow: 0,
    drawMode: 'fill',
    shape: 'duck',
    backdrop: { kind: 'gradient', to: '#8fd0d8' },
  },
}

/** Display order for the theme chip grid (2 columns). */
export const THEME_ORDER: ThemeId[] = [
  'neon',
  'retro',
  'asteroids',
  'autumnal',
  'space',
  'duckSeason',
]

/** Unknown persisted/requested theme id falls back to neon. */
export function getTheme(id: string): Theme {
  return (THEMES as Record<string, Theme>)[id] ?? THEMES.neon
}
