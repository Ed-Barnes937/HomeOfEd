import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { generatePaper, PAPER_FLAT } from './paper.ts'

/** Mean of the green channel — a stand-in for luminance, all three track together. */
function meanChannel(rgba: Uint8ClampedArray, offset: number): number {
  let sum = 0
  for (let i = offset; i < rgba.length; i += 4) sum += rgba[i]!
  return sum / (rgba.length / 4)
}

/** Mean absolute difference between neighbours `dx,dy` apart, green channel. */
function meanNeighbourDelta(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  dx: number,
  dy: number,
): number {
  let sum = 0
  let n = 0
  for (let y = 0; y + dy < h; y++) {
    for (let x = 0; x + dx < w; x++) {
      sum += Math.abs(rgba[(y * w + x) * 4 + 1]! - rgba[((y + dy) * w + x + dx) * 4 + 1]!)
      n++
    }
  }
  return sum / n
}

describe('procedural paper', () => {
  it('fills w × h opaque RGBA', () => {
    const rgba = generatePaper(40, 30)
    expect(rgba).toHaveLength(40 * 30 * 4)
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(255)
  })

  it('is the same sheet every time (fixed seed)', () => {
    expect(Array.from(generatePaper(64, 48))).toEqual(Array.from(generatePaper(64, 48)))
  })

  it('is warm — R above G above B, with the blue channel dropping furthest', () => {
    const rgba = generatePaper(96, 96)
    const r = meanChannel(rgba, 0)
    const g = meanChannel(rgba, 1)
    const b = meanChannel(rgba, 2)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    // The aged-rag impression: the R→G step is small, the G→B step much larger.
    expect(g - b).toBeGreaterThan((r - g) * 2)
  })

  it('reads as light paper, not as a mid-grey', () => {
    expect(meanChannel(generatePaper(96, 96), 1)).toBeGreaterThan(230)
  })

  it('has visible texture but is not noise-blasted', () => {
    const rgba = generatePaper(128, 128)
    let sum = 0
    let sumSq = 0
    const n = rgba.length / 4
    for (let i = 1; i < rgba.length; i += 4) {
      sum += rgba[i]!
      sumSq += rgba[i]! * rgba[i]!
    }
    const sd = Math.sqrt(sumSq / n - (sum / n) ** 2)
    expect(sd).toBeGreaterThan(1.5) // texture is actually there
    expect(sd).toBeLessThan(12) // and it is paper, not sandpaper
  })

  it('is anisotropic — the fibre runs horizontally', () => {
    const w = 192
    const h = 192
    const rgba = generatePaper(w, h)
    // Along the fibre the field varies slowly; across it, quickly. Sample a few
    // pixels out so the comparison is about the fibre, not the 1px relief tap.
    const along = meanNeighbourDelta(rgba, w, h, 4, 0)
    const across = meanNeighbourDelta(rgba, w, h, 0, 4)
    expect(across).toBeGreaterThan(along * 1.15)
  })

  it('averages out to PAPER_FLAT (the fill under the sheet, and --espy-card)', () => {
    const rgba = generatePaper(160, 160)
    const flat = [1, 3, 5].map((i) => parseInt(PAPER_FLAT.slice(i, i + 2), 16))
    for (const channel of [0, 1, 2]) {
      expect(Math.abs(meanChannel(rgba, channel) - flat[channel]!)).toBeLessThan(2)
    }
  })

  it('is the value --espy-card is set to, so the chrome behind the canvas matches', () => {
    const tokens = readFileSync(new URL('../../../styles/tokens.scss', import.meta.url), 'utf8')
    expect(tokens).toMatch(new RegExp(`--espy-card:\\s*${PAPER_FLAT}\\s*;`))
  })
})
