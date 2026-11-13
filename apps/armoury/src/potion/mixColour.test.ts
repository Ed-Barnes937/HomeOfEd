import { describe, expect, it } from 'vitest'

import { effectColour, hexToOklch, murkyColour, oklchToHex } from './mixColour.ts'

describe('OKLCH conversion', () => {
  it('puts white at full lightness with no chroma, and black at none', () => {
    expect(hexToOklch('#ffffff').l).toBeCloseTo(1, 3)
    expect(hexToOklch('#ffffff').c).toBeLessThan(0.001)
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 3)
  })

  it('round-trips a hex colour', () => {
    for (const hex of ['#5b8def', '#d9467a', '#7ccf4f', '#ece6f4', '#4b3f8f', '#c9343f']) {
      const { l, c, h } = hexToOklch(hex)
      expect(oklchToHex(l, c, h)).toBe(hex)
    }
  })

  it('reads hue in degrees from 0 to 360', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffff00']) {
      const { h } = hexToOklch(hex)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
    expect(hexToOklch('#ff0000').h).toBeCloseTo(29.2, 0)
  })
})

describe('effectColour', () => {
  it('is deterministic', () => {
    expect(effectColour(123, 2)).toBe(effectColour(123, 2))
  })

  it('stays a jewel colour at every angle and reach', () => {
    for (let angle = 0; angle < 360; angle += 5) {
      for (const reach of [0.78, 1.5, 2.2, 3]) {
        const { l, c } = hexToOklch(effectColour(angle, reach))
        expect(c, `${angle} ${reach}`).toBeGreaterThanOrEqual(0.12 - 0.005)
        expect(l, `${angle} ${reach}`).toBeGreaterThanOrEqual(0.58 - 0.01)
        expect(l, `${angle} ${reach}`).toBeLessThanOrEqual(0.78 + 0.01)
      }
    }
  })

  it('is a bluebell at its own angle and full reach', () => {
    expect(effectColour(160, 3)).toBe('#5b8def')
  })
})

describe('murkyColour', () => {
  const colours = ['#7ccf4f', '#5b8def', '#c9343f']

  it('is a dull brown-green, never bright', () => {
    const { l, c } = hexToOklch(murkyColour(colours))
    expect(c).toBeLessThanOrEqual(0.05 + 0.005)
    expect(l).toBeLessThanOrEqual(0.5)
    expect(l).toBeGreaterThanOrEqual(0.38 - 0.01)
  })

  it('is deterministic and a little different for different ingredients', () => {
    expect(murkyColour(colours)).toBe(murkyColour(colours))
    expect(murkyColour(colours)).not.toBe(murkyColour(['#ece6f4', '#4b3f8f', '#c9343f']))
  })
})
