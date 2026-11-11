import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  allowedOptions,
  type ChoiceParam,
  isVisible,
  normalise,
  type NumberParam,
  type Params,
  randomise,
  seededRandom,
} from '../engine/schema.ts'
import { compileSword, type SwordSpec } from './compile.ts'
import { FAMILIES, type Family } from './families.ts'
import { OUTLINE_POINTS, swordOutline } from './outline.ts'
import { swordSchema } from './swordSchema.ts'

const KINDS = Object.keys(FAMILIES) as Family[]
const sword = (raw: Record<string, unknown>) => normalise(swordSchema, raw)
const CHOICES = swordSchema.params.filter(
  (d): d is ChoiceParam => d.kind === 'choice' && d.key !== 'family',
)
const SLIDERS = swordSchema.params.filter((d): d is NumberParam => d.kind === 'number')

/**
 * Each Kind with sword i taking option i of every choice it allows (sword 0 is its signature),
 * every slider at its least and then its most, and 5 random swords.
 */
function catalogue(): { name: string; p: Params; spec: SwordSpec }[] {
  const out: { name: string; p: Params }[] = []
  for (const family of KINDS) {
    const base = sword({ family })
    const options = CHOICES.map((def) => [def.key, allowedOptions(def, base).map((o) => o.value)] as const)
    const n = Math.max(...options.map(([, values]) => values.length))
    for (let i = 0; i < n; i++) {
      const picked = options.map(([key, values]) => [key, values[i % values.length]] as const)
      out.push({ name: `${family} options ${i}`, p: sword({ ...Object.fromEntries(picked), family }) })
    }
    for (const end of ['min', 'max'] as const)
      out.push({
        name: `${family} sliders ${end}`,
        p: sword({ family, waves: 'flame', ...Object.fromEntries(SLIDERS.map((d) => [d.key, d[end]])) }),
      })
    const rng = seededRandom(600 + family.length)
    for (let i = 0; i < 5; i++)
      out.push({
        name: `${family} random ${i}`,
        p: randomise(swordSchema, rng, { keep: { family }, locked: ['kind'] }),
      })
  }
  return out.map(({ name, p }) => ({ name, p, spec: compileSword(p) }))
}
const SWORDS = catalogue()
const outlines = new Map<SwordSpec, [number, number][][]>()
const outlineOf = (spec: SwordSpec) => {
  if (!outlines.has(spec)) outlines.set(spec, swordOutline(spec))
  return outlines.get(spec)!
}

const signedArea = (poly: [number, number][]) => {
  let a = 0
  poly.forEach(([x0, y0], i) => {
    const [x1, y1] = poly[(i + 1) % poly.length]!
    a += x0 * y1 - x1 * y0
  })
  return a / 2
}

describe('swordOutline', () => {
  it('is drawn for every option a Kind shows on its signature sword', () => {
    const missing: string[] = []
    for (const def of CHOICES)
      for (const family of KINDS)
        for (const { value } of allowedOptions(def, sword({ family }))) {
          const shown = sword({ family, [def.key]: value })
          if (shown[def.key] !== value || !isVisible(def, shown)) continue
          if (!SWORDS.some(({ p }) => p[def.key] === value && isVisible(def, p)))
            missing.push(`${def.key} ${value}`)
        }
    expect([...new Set(missing)]).toEqual([])
  })

  it('is closed polylines, all wound the same way, under the point budget', () => {
    expect(OUTLINE_POINTS).toBeLessThan(400)
    for (const { name, spec } of SWORDS) {
      const outline = outlineOf(spec)
      const points = outline.reduce((n, l) => n + l.length, 0)
      expect(points, name).toBeLessThanOrEqual(OUTLINE_POINTS)
      for (const line of outline) {
        expect(line.length, name).toBeGreaterThanOrEqual(3)
        expect(line.flat().every(Number.isFinite), name).toBe(true)
        expect(signedArea(line), name).toBeGreaterThan(0)
      }
    }
  })

  it('runs from the pommel end at z = 0 to the tip on the axis', () => {
    for (const { name, spec } of SWORDS) {
      const pts = outlineOf(spec).flat()
      const tip = pts.reduce((a, b) => (b[0] > a[0] ? b : a))
      expect(Math.abs(tip[1]), name).toBeLessThan(0.01)
      // A chord-rotated hilt tilts, so a curved sword's pommel dips a little below z = 0.
      expect(Math.min(...pts.map(([z]) => z)), name).toBeGreaterThan(spec.blade.curve ? -4 : -0.01)
      if (!spec.blade.curve) expect(tip[0], name).toBeCloseTo(spec.lengthMm, 3)
    }
  })

  it('draws the edge at -y, and the convex edge of a curved blade bowing out from the chord', () => {
    const straight = compileSword(sword({ family: 'knight' }))
    const mid = (straight.blade.from + straight.blade.to) / 2
    const ys = swordOutline(straight)
      .flat()
      .filter(([z]) => Math.abs(z - mid) < 20)
      .map(([, y]) => y)
    expect(Math.min(...ys)).toBeCloseTo(-Math.max(...ys), 0)
    const sabre = compileSword(sword({ family: 'sabre', curve: 1 }))
    const blade = swordOutline(sabre).at(-1)!
    const middle = blade.filter(([z]) => Math.abs(z - sabre.lengthMm * 0.6) < 15)
    expect(Math.max(...middle.map(([, y]) => y))).toBeLessThan(0)
  })

  it('imports none of the mesh modules, so it can ship in the main chunk', () => {
    const source = readFileSync(new URL('./outline.ts', import.meta.url), 'utf8')
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    for (const banned of ['./geometry.ts', './blade.ts', './hilt.ts', './sweep.ts'])
      expect(imports).not.toContain(banned)
    expect(imports.every((i) => !i!.includes('three'))).toBe(true)
  })
})
