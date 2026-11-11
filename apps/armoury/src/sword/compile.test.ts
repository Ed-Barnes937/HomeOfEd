import { describe, expect, it } from 'vitest'

import { isVisible, normalise, type Params, randomise, seededRandom } from '../engine/schema.ts'
import { compileSword, type SwordSpec } from './compile.ts'
import { type Curve, sample } from './curve.ts'
import { FAMILIES, type Family, overallLengthMm } from './families.ts'
import { swordSchema } from './swordSchema.ts'

const KINDS = Object.keys(FAMILIES) as Family[]
const PER_KIND = ['profile', 'middle', 'tip', 'ricasso', 'guard', 'wrap', 'pommel'] as const
const BAR_GUARDS = ['straight', 'curved', 'sCurve', 'winged', 'knuckleBow', 'swept']
const EPS = 1e-6
const sword = (raw: Record<string, unknown>) => normalise(swordSchema, raw)

/** Every Kind with every allowed per-Kind option, plus 30 random swords per Kind. */
function catalogue(): Params[] {
  const out: Params[] = []
  for (const family of KINDS) {
    for (const key of PER_KIND)
      for (const value of FAMILIES[family][key])
        out.push(sword({ family, [key]: value, taper: value === 'rounded' ? 0.3 : 0.5 }))
    const rng = seededRandom(1000 + family.length)
    for (let i = 0; i < 30; i++)
      out.push(randomise(swordSchema, rng, { keep: { family }, locked: ['kind'] }))
  }
  return out
}
const SWORDS = catalogue()

const widthAt = (spec: SwordSpec, u: number) =>
  sample(spec.blade.halfWidth, u) + sample(spec.blade.backWidth ?? spec.blade.halfWidth, u)
const bladeU = (spec: SwordSpec, z: number) =>
  (z - spec.blade.from) / (spec.blade.to - spec.blade.from)

function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbersIn)
  return []
}

describe('sample', () => {
  const curve: Curve = [
    [0, 10],
    [0.5, 12],
    [0.6, 12],
    [1, 0],
  ]

  it('passes through its points and holds its ends', () => {
    for (const [u, v] of curve) expect(sample(curve, u)).toBeCloseTo(v, 9)
    expect(sample(curve, -1)).toBe(10)
    expect(sample(curve, 2)).toBe(0)
  })

  it('never overshoots between points', () => {
    for (let u = 0; u <= 1; u += 0.01) {
      const v = sample(curve, u)
      expect(v).toBeGreaterThanOrEqual(-EPS)
      expect(v).toBeLessThanOrEqual(12 + EPS)
    }
    for (let u = 0.5; u <= 0.6; u += 0.01) expect(sample(curve, u)).toBeCloseTo(12, 9)
  })
})

describe('compileSword', () => {
  it('compiles the default Knight sword', () => {
    const spec = compileSword(sword({}))
    expect(spec.family).toBe('knight')
    expect(spec.blade.edges).toBe('double')
    expect(spec.blade.fullers).toHaveLength(1)
    expect(spec.guard.style).toBe('straight')
    expect(spec.lengthMm).toBeGreaterThan(900)
    expect(spec.lengthMm).toBeLessThan(1100)
  })

  it('has no NaN and stays deterministic', () => {
    for (const p of SWORDS) {
      const spec = compileSword(p)
      for (const n of numbersIn(spec)) expect(Number.isFinite(n)).toBe(true)
      expect(compileSword({ ...p })).toEqual(spec)
    }
  })

  it('lays out pommel, grip, guard and blade end to end, inside the bands', () => {
    for (const p of SWORDS) {
      const f = FAMILIES[p.family as Family]
      const s = compileSword(p)
      const B = s.blade.to - s.blade.from
      const G = s.grip.to - s.grip.from
      expect(s.pommel.from).toBe(0)
      expect(s.grip.from).toBeCloseTo(s.pommel.to, 9)
      expect(s.guard.from).toBeCloseTo(s.grip.to, 9)
      expect(s.blade.from).toBeCloseTo(s.guard.to, 9)
      expect(s.blade.to).toBeCloseTo(s.lengthMm, 9)
      expect(s.lengthMm).toBeCloseTo(overallLengthMm(p), 9)
      expect(B).toBeGreaterThanOrEqual(f.blade[0] - EPS)
      expect(B).toBeLessThanOrEqual(f.blade[1] + EPS)
      expect(G).toBeGreaterThanOrEqual(f.grip[0] - EPS)
      expect(G).toBeLessThanOrEqual(f.grip[1] + EPS)
      const base = widthAt(s, 0)
      expect(base).toBeGreaterThanOrEqual(f.baseWidth[0] - EPS)
      expect(base).toBeLessThanOrEqual(f.baseWidth[1] + EPS)
      if (p.family !== 'dagger') expect(B).toBeGreaterThan(s.blade.from)
      const gripAt = s.gripAt * s.lengthMm
      expect(gripAt).toBeGreaterThan(s.grip.from)
      expect(gripAt).toBeLessThan(s.grip.to)
    }
  })

  it('closes the blade to a point and keeps a leaf within 1.2 of the base', () => {
    for (const p of SWORDS) {
      const s = compileSword(p)
      const half = s.blade.halfWidth
      expect(sample(half, 1)).toBeCloseTo(0, 9)
      if (s.blade.backWidth) expect(sample(s.blade.backWidth, 1)).toBeCloseTo(0, 9)
      for (const [, v] of half) expect(v).toBeGreaterThanOrEqual(0)
      if (s.blade.edges === 'double')
        for (let u = 0; u <= 1; u += 0.01)
          expect(sample(half, u)).toBeLessThanOrEqual(1.2 * sample(half, 0) + EPS)
      expect(s.blade.thickness.every(([, t]) => t > 0)).toBe(true)
      expect(sample(s.blade.thickness, s.blade.tipFrom)).toBeLessThanOrEqual(
        p.family === 'katana' ? 4.5 + EPS : 3 + EPS,
      )
    }
  })

  it('sizes the guard and pommel by the blade', () => {
    for (const p of SWORDS) {
      const f = FAMILIES[p.family as Family]
      const s = compileSword(p)
      const base = widthAt(s, 0)
      const span = s.guard.span
      if (BAR_GUARDS.includes(s.guard.style)) {
        expect(span).toBeGreaterThanOrEqual(base + 60 - EPS)
        expect(span).toBeGreaterThanOrEqual(f.guardSpan[0] - EPS)
        expect(span).toBeLessThanOrEqual(Math.max(f.guardSpan[1], base + 80) + EPS)
      } else {
        const band = s.guard.style === 'disc' ? f.discSpan! : f.domeSpan!
        expect(span).toBeGreaterThanOrEqual(band[0] - EPS)
        expect(span).toBeGreaterThanOrEqual(1.4 * base - EPS)
        expect(span).toBeLessThanOrEqual(Math.max(band[1], 1.4 * base + 17) + EPS)
      }
      const diameter = s.pommel.radius * 2
      const gripEnd = 2 * sample(s.grip.radius, 0)
      if (s.pommel.style === 'cap') {
        expect(diameter / gripEnd).toBeGreaterThanOrEqual(1.05 - EPS)
        expect(diameter / gripEnd).toBeLessThanOrEqual(1.15 + EPS)
      } else {
        // A ball is drawn smaller (tuned at G1), except where a bow meets it.
        const ball =
          s.pommel.style === 'ball' && !['swept', 'knuckleBow'].includes(s.guard.style) ? 0.82 : 1
        expect(diameter).toBeGreaterThanOrEqual(base * (f.hands === 2 ? 1.0 : 0.8) * ball - EPS)
        expect(diameter).toBeGreaterThanOrEqual(1.2 * gripEnd)
        expect(diameter <= 1.4 * base + EPS || diameter <= 1.6 * gripEnd).toBe(true)
      }
      const bigger = compileSword(sword({ ...p, pommelSize: 1 })).pommel.radius
      const smaller = compileSword(sword({ ...p, pommelSize: 0 })).pommel.radius
      expect(bigger).toBeGreaterThan(smaller)
    }
  })

  it('sets real guard sizes by default, and the Guard size slider always moves the guard', () => {
    expect(compileSword(sword({})).guard.span).toBeGreaterThanOrEqual(200)
    expect(compileSword(sword({})).guard.span).toBeLessThanOrEqual(215)
    expect(compileSword(sword({ family: 'dagger' })).guard.span).toBeGreaterThanOrEqual(100)
    expect(compileSword(sword({ family: 'dagger' })).guard.span).toBeLessThanOrEqual(110)
    for (const [family, guard] of [
      ['shortSword', 'dome'],
      ['dagger', 'disc'],
      ['katana', 'disc'],
      ['rapier', 'cup'],
    ]) {
      const broad = compileSword(sword({ family, guard, bladeWidth: 1, bladeLength: 1 }))
      expect(broad.guard.span, family).toBeGreaterThanOrEqual(1.4 * widthAt(broad, 0) - EPS)
    }
    for (const p of SWORDS) {
      const span = (guardWidth: number) => compileSword(sword({ ...p, guardWidth })).guard.span
      expect(span(1) - span(0), `${p.family} ${p.guard}`).toBeGreaterThanOrEqual(15)
      expect(span(0.6)).toBeGreaterThan(span(0.4))
    }
  })

  it('keeps runes and engraving on the flat off the fullers', () => {
    const overlaps = (a: { from: number; to: number }, b: { from: number; to: number }) =>
      a.from < b.to && b.from < a.to
    let checked = 0
    for (const p of SWORDS)
      for (const runes of ['none', 'groove', 'base', 'centre']) {
        const q = sword({ ...p, runes, engraving: 'vine' })
        const s = compileSword(q)
        const onFlat = [s.engraving, s.runes?.where === 'flat' ? s.runes : null]
        for (const mark of onFlat)
          for (const fl of s.blade.fullers) if (mark) expect(overlaps(mark, fl)).toBe(false)
        if (s.runes?.where === 'fuller') {
          const inside = s.blade.fullers.some(
            (fl) => s.runes!.from >= fl.from && s.runes!.to <= fl.to,
          )
          expect(inside).toBe(true)
        }
        checked++
      }
    expect(checked).toBeGreaterThan(0)
  })

  it('measures a tip by the width where it starts', () => {
    const tipMm = (raw: Record<string, unknown>) => {
      const s = compileSword(sword({ family: 'dagger', profile: 'leaf', ...raw }))
      const B = s.blade.to - s.blade.from
      return {
        run: (1 - s.blade.tipFrom) * B,
        width: 2 * sample(s.blade.halfWidth, s.blade.tipFrom),
      }
    }
    const sharp = tipMm({ tip: 'sharp' })
    expect(sharp.run).toBeGreaterThanOrEqual(1.05 * sharp.width)
    expect(tipMm({ tip: 'longPoint' }).run).toBeGreaterThan(1.5 * sharp.run)
  })

  it('keeps fullers off the ricasso and out of the last 15%, and shallow', () => {
    for (const p of SWORDS) {
      const s = compileSword(p)
      const B = s.blade.to - s.blade.from
      for (const fl of s.blade.fullers) {
        expect(fl.from).toBeGreaterThanOrEqual(s.blade.from + s.blade.ricasso)
        expect(fl.to).toBeLessThanOrEqual(s.blade.from + 0.85 * B + EPS)
        expect(fl.to - fl.from).toBeGreaterThanOrEqual(2 * fl.fade - EPS)
        expect(fl.fade).toBeGreaterThanOrEqual(30)
        expect(fl.depth).toBeLessThanOrEqual(0.35)
        expect(fl.offset - fl.halfWidth).toBeGreaterThan(0)
        expect(fl.offset + fl.halfWidth).toBeLessThan(1)
      }
    }
  })

  it('fits waves to the blade and curves only single-edged Kinds', () => {
    let waved = 0
    for (const p of SWORDS) {
      const s = compileSword(p)
      const B = s.blade.to - s.blade.from
      expect(s.blade.curve === null).toBe(s.blade.edges === 'double')
      const w = s.blade.wave
      expect(w !== null).toBe(p.waves === 'flame')
      if (!w) continue
      waved++
      expect(s.blade.ricasso).toBeGreaterThan(0)
      expect(w.from).toBeGreaterThanOrEqual(s.blade.from + s.blade.ricasso)
      expect(w.to).toBeLessThanOrEqual(s.blade.from + 0.88 * B + EPS)
      expect(w.amp).toBeLessThanOrEqual(0.08)
      expect(w.lengthMm).toBeGreaterThanOrEqual(60)
      expect(w.count).toBeLessThanOrEqual(p.waveCount as number)
      expect(w.count * w.lengthMm).toBeCloseTo(w.to - w.from, 6)
    }
    expect(waved).toBeGreaterThan(0)
  })

  it('maps the middle to a section', () => {
    const at = (raw: Record<string, unknown>) => compileSword(sword(raw)).blade
    expect(at({ middle: 'flat' }).section).toBe('lenticular')
    expect(at({ middle: 'ridge' }).section).toBe('diamond')
    expect(at({ middle: 'groove2' }).fullers).toHaveLength(2)
    expect(at({ family: 'longsword', middle: 'groove3' }).fullers).toHaveLength(3)
    expect(at({ family: 'sabre', middle: 'flat' }).section).toBe('wedge')
    const sabre = at({ family: 'sabre', middle: 'groove1' })
    expect(sabre.fullers[0]!.offset).toBeGreaterThan(0.5)
    const katana = at({ family: 'katana', middle: 'ridgeGroove' })
    expect(katana.section).toBe('wedge')
    expect(katana.ridgeAt).toBeGreaterThanOrEqual(0.62)
    expect(katana.ridgeAt).toBeLessThanOrEqual(0.7)
    expect(katana.fullers[0]!.offset - katana.fullers[0]!.halfWidth).toBeGreaterThan(
      katana.ridgeAt!,
    )
    expect(at({}).ridgeAt).toBeNull()
  })

  it('builds the Katana with its collar and the flared Sabre with a sharp back', () => {
    const katana = compileSword(sword({ family: 'katana' }))
    expect(katana.collar).toEqual({ from: katana.blade.from, to: katana.blade.from + 25 })
    expect(katana.finish.pattern).toBe('plain')
    expect(compileSword(sword({})).collar).toBeNull()
    expect(compileSword(sword({ family: 'sabre', profile: 'flared' })).blade.backBevelFrom).toBe(
      0.7,
    )
    expect(compileSword(sword({ family: 'sabre' })).blade.backBevelFrom).toBeNull()
  })

  it('makes a bigger Katana point with kissakiSize', () => {
    const tipFrom = (k: number) =>
      compileSword(sword({ family: 'katana', kissakiSize: k })).blade.tipFrom
    expect(tipFrom(1)).toBeLessThan(tipFrom(0))
  })

  it('puts runes in the groove, gems on their seats and the engraving at the base', () => {
    const s = compileSword(sword({ runes: 'groove', gems: 'both', gemColour: 'ruby' }))
    const fuller = s.blade.fullers[0]!
    expect(s.runes).toMatchObject({ where: 'fuller', colour: '#8fe3ff' })
    expect(s.runes!.from).toBeCloseTo(s.blade.from + 40, 6)
    const engraved = compileSword(sword({ runes: 'groove', engraving: 'vine' }))
    expect(engraved.blade.fullers[0]!.from).toBeGreaterThan(engraved.engraving!.to)
    expect(engraved.runes!.from).toBeGreaterThanOrEqual(engraved.blade.fullers[0]!.from)
    expect(s.runes!.to).toBeLessThanOrEqual(fuller.to)
    const B = s.blade.to - s.blade.from
    expect(s.runes!.to - s.runes!.from).toBeGreaterThanOrEqual(0.25 * B - EPS)
    const fullerMm = 2 * fuller.halfWidth * widthAt(s, bladeU(s, s.runes!.from))
    expect((2 * s.runes!.halfHeight) / fullerMm).toBeGreaterThanOrEqual(0.6 - EPS)
    expect((2 * s.runes!.halfHeight) / fullerMm).toBeLessThanOrEqual(0.7 + EPS)
    expect(s.gems.map((g) => g.at).sort()).toEqual(['guard', 'pommel'])
    expect(s.glow).toMatchObject({ colour: '#ff2440' })
    expect(engraved.engraving).toMatchObject({ tile: 'vine' })
    expect(engraved.engraving!.from).toBeGreaterThanOrEqual(engraved.blade.from)

    const base = compileSword(sword({ middle: 'flat', runes: 'base', engraving: 'dots' }))
    expect(base.runes!.where).toBe('flat')
    expect([3, 4]).toContain(base.runes!.glyphs)
    expect(base.runes!.from).toBeGreaterThanOrEqual(base.engraving!.to)
    const grooved = compileSword(sword({ runes: 'base' }))
    expect(grooved.runes!.where).toBe('fuller')
    expect([3, 4]).toContain(grooved.runes!.glyphs)
    expect(compileSword(sword({ gems: 'pommel' })).glow).toMatchObject({ colour: '#8fe3ff' })
    expect(compileSword(sword({})).glow).toBeNull()
  })

  it('ignores every hidden param', () => {
    let checked = 0
    for (const p of SWORDS.filter((_, i) => i % 3 === 0)) {
      const spec = compileSword(p)
      for (const def of swordSchema.params) {
        if (isVisible(def, p)) continue
        const values = def.kind === 'number' ? [def.min, def.max] : def.options.map((o) => o.value)
        for (const value of values) {
          const raw = { ...p, [def.key]: value }
          const q = normalise(swordSchema, raw)
          if (JSON.stringify(q) !== JSON.stringify(raw)) continue
          checked++
          expect(compileSword(q), `${p.family} hidden ${def.key}=${value}`).toEqual(spec)
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})
