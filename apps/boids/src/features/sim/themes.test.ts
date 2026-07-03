import { describe, expect, it } from 'vitest'

import { getTheme, THEMES, THEME_ORDER } from './themes.ts'

describe('THEMES', () => {
  it('matches the design handoff table exactly', () => {
    expect(THEMES.neon).toEqual({
      id: 'neon',
      name: 'neon',
      background: '#08080c',
      palette: ['#00e6ff', '#ff2bd6', '#8b5cff'],
      glow: 14,
      drawMode: 'fill',
    })
    expect(THEMES.retro).toEqual({
      id: 'retro',
      name: 'retro',
      background: '#221436',
      palette: ['#ff5d8f', '#ffb03a', '#39d5c6'],
      glow: 9,
      drawMode: 'fill',
    })
    expect(THEMES.asteroids).toEqual({
      id: 'asteroids',
      name: 'asteroids',
      background: '#000000',
      palette: ['#ffffff', '#d9e2ff'],
      glow: 0,
      drawMode: 'stroke',
    })
    expect(THEMES.autumnal).toEqual({
      id: 'autumnal',
      name: 'autumnal',
      background: '#f2ece0',
      palette: ['#b8451f', '#d98a37', '#7c7a3a', '#9c392c'],
      glow: 0,
      drawMode: 'fill',
    })
  })

  it('defines the display order neon, retro, asteroids, autumnal', () => {
    expect(THEME_ORDER).toEqual(['neon', 'retro', 'asteroids', 'autumnal'])
  })
})

describe('getTheme', () => {
  it('returns the matching theme for a known id', () => {
    expect(getTheme('retro').background).toBe('#221436')
  })

  it('falls back to neon for an unknown id', () => {
    expect(getTheme('not-a-real-theme')).toEqual(THEMES.neon)
  })
})
