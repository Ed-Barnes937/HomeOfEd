/**
 * The canvas-facing subset of a theme — literal colours, not CSS custom
 * properties (those live in SCSS and are applied separately via
 * `data-theme`). Full four-preset table + id→Theme lookup with fallback land
 * in B5; `neonTheme` is exported now as the fixed default for B3's canvas +
 * loop work.
 */
export interface Theme {
  id: 'neon' | 'retro' | 'asteroids' | 'autumnal'
  name: string
  /** Canvas clear colour each frame. */
  background: string
  /** Boid colours; renderer maps colorIndex % palette.length. */
  palette: string[]
  /** shadowBlur; 0 disables glow. */
  glow: number
  drawMode: 'fill' | 'stroke'
}

export const neonTheme: Theme = {
  id: 'neon',
  name: 'neon',
  background: '#08080c',
  palette: ['#00e6ff', '#ff2bd6', '#8b5cff'],
  glow: 14,
  drawMode: 'fill',
}
