import type { ThemeId } from './settings.ts'

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
}

/** Display order for the 2x2 theme chip grid. */
export const THEME_ORDER: ThemeId[] = ['neon', 'retro', 'asteroids', 'autumnal']

/** Unknown persisted/requested theme id falls back to neon. */
export function getTheme(id: string): Theme {
  return (THEMES as Record<string, Theme>)[id] ?? THEMES.neon
}
