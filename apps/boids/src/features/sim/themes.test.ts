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
    expect(THEMES.space).toEqual({
      id: 'space',
      name: 'space',
      background: '#060a18',
      palette: ['#e6ecff', '#ff6b6b', '#ffd166'],
      glow: 8,
      drawMode: 'fill',
      shape: 'rocket',
      backdrop: { kind: 'stars' },
    })
    expect(THEMES.duckSeason).toEqual({
      id: 'duckSeason',
      name: 'duck season',
      background: '#cdeef7',
      palette: ['#f4c542', '#e2913a', '#8a5a2b'],
      glow: 0,
      drawMode: 'fill',
      shape: 'duck',
      backdrop: { kind: 'gradient', to: '#8fd0d8' },
    })
  })

  it('defines the display order neon, retro, asteroids, autumnal, space, duck season', () => {
    expect(THEME_ORDER).toEqual([
      'neon',
      'retro',
      'asteroids',
      'autumnal',
      'space',
      'duckSeason',
    ])
  })

  it('gives the space and duck themes a signature boid shape', () => {
    expect(THEMES.space.shape).toBe('rocket')
    expect(THEMES.duckSeason.shape).toBe('duck')
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
