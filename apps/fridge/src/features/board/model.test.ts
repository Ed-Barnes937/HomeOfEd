import { describe, expect, it } from 'vitest'

import { FRACTIONS, PALETTE, PALETTE_ORDER, sizeFor } from './model.ts'

describe('PALETTE', () => {
  it('has the six keys in auto-cycle order', () => {
    expect(PALETTE_ORDER).toEqual(['red', 'blue', 'green', 'yellow', 'orange', 'purple'])
    expect(Object.keys(PALETTE)).toEqual(PALETTE_ORDER)
  })

  it('matches the shade triples from tokens.css', () => {
    expect(PALETTE.red).toEqual({ main: '#e8503a', dark: '#a12b1d', light: '#ff9179' })
    expect(PALETTE.blue).toEqual({ main: '#2f7fd6', dark: '#194f8f', light: '#83bdf5' })
    expect(PALETTE.green).toEqual({ main: '#3fae6b', dark: '#1f7343', light: '#8ee2ab' })
    expect(PALETTE.yellow).toEqual({ main: '#f0b429', dark: '#a9760f', light: '#ffdd7a' })
    expect(PALETTE.orange).toEqual({ main: '#ef8a35', dark: '#a9560f', light: '#ffc389' })
    expect(PALETTE.purple).toEqual({ main: '#8a5cd1', dark: '#553497', light: '#c4a6f2' })
  })
})

describe('sizeFor', () => {
  it('returns the exact box size per type', () => {
    expect(sizeFor('letter')).toEqual({ w: 52, h: 60 })
    expect(sizeFor('number')).toEqual({ w: 50, h: 60 })
    expect(sizeFor('fraction')).toEqual({ w: 64, h: 64 })
  })
})

describe('FRACTIONS', () => {
  it('maps the shape glyphs to their wedge degrees', () => {
    expect(FRACTIONS.map((f) => f.deg)).toEqual([90, 120, 180, 270, 360])
    expect(FRACTIONS.map((f) => f.glyph)).toEqual(['¼', '⅓', '½', '¾', '●'])
  })
})
