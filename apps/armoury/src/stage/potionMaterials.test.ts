import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { BOTTLES, type ShapeId } from '../potion/bottles.ts'
import { compilePotion } from '../potion/compile.ts'
import { buildPotionMesh } from '../potion/geometry.ts'
import { bottleProfile } from '../potion/profile.ts'
import { MAX_POURS, potionSchema } from '../potion/potionSchema.ts'
import { normalise } from '../engine/schema.ts'
import { withPours } from '../potion/pours.ts'
import { tagLayout } from '../potion/geometry.ts'
import { INGREDIENTS, type IngredientId, type Trait } from '../potion/ingredients.ts'
import { mixPotion, type Recipe } from '../potion/mix.ts'
import { traitLook } from '../potion/traits.ts'
import { srgbToLinear } from '../items/colour.ts'
import { floorAt, levelsAt, levelTable } from '../potion/tipped.ts'
import { BLOOM_THRESHOLD } from './stage.ts'
import {
  bandEdges,
  CLOUD_EDGE,
  createGlass,
  createLiquid,
  freezeFrom,
  GLASS_LOOKS,
  LABEL_LOOKS,
  labelLines,
  LiquidClock,
  LIQUID,
  PAPERS,
  paperMask,
  REST_CAP,
  RESTING_EMISSIVE,
  softCap,
  STOPPER_LOOKS,
  TRAIT_GAIN,
  VORTEX,
  vortexShift,
} from './potionMaterials.ts'
import { potionShow, PotionShowPlayer, SHOW_BEATS } from './potionShow.ts'

const TRAITS: Trait[] = ['clear', 'cloud', 'fizz', 'glitter', 'glow', 'swirl', 'murk']

const optionsOf = (key: string) => {
  const param = potionSchema.params.find((p) => p.key === key)
  if (param?.kind !== 'choice') throw new Error(`${key} is not a choice`)
  return param.options.map((o) => o.value)
}

const inUnit = (n: number) => n >= 0 && n <= 1
const rgbInUnit = (c: readonly number[]) => c.length === 3 && c.every(inUnit)

describe('potion material tables', () => {
  it('has a glass row for every glass, its colours linear and in range', () => {
    for (const value of optionsOf('glass')) {
      const row = GLASS_LOOKS[value as keyof typeof GLASS_LOOKS]
      expect(row, value).toBeDefined()
      for (const c of [row.through, row.edge, row.rim, row.body])
        expect(rgbInUnit(c), value).toBe(true)
      expect(inUnit(row.alpha) && inUnit(row.edgeAlpha) && inUnit(row.roughness), value).toBe(true)
    }
  })

  it('lets clear glass through nearly untouched and tints the others', () => {
    expect(Math.min(...GLASS_LOOKS.clear.through)).toBeGreaterThan(0.9)
    for (const tint of ['sea', 'amber', 'violet', 'smoky'] as const) {
      const [r, g, b] = GLASS_LOOKS[tint].through
      expect(Math.max(r, g, b) - Math.min(r, g, b) > 0.05 || tint === 'smoky', tint).toBe(true)
      expect(Math.min(r, g, b), tint).toBeGreaterThan(0.25)
    }
  })

  it('has a stopper row for every stopper', () => {
    for (const value of optionsOf('stopper')) {
      const row = STOPPER_LOOKS[value as keyof typeof STOPPER_LOOKS]
      expect(row, value).toBeDefined()
      expect(inUnit(row.roughness), value).toBe(true)
      if (row.colour) expect(rgbInUnit(row.colour), value).toBe(true)
    }
  })

  it('has a label row for every label, none drawing nothing', () => {
    for (const value of optionsOf('label')) expect(value in LABEL_LOOKS, value).toBe(true)
    expect(LABEL_LOOKS.none).toBeNull()
    for (const value of ['round', 'banner', 'tag'] as const)
      expect(LABEL_LOOKS[value]!.maxLines, value).toBeGreaterThan(0)
  })

  it('has plain and gold paper, linear and in range', () => {
    for (const paper of [PAPERS.plain, PAPERS.gold]) {
      expect(rgbInUnit(paper.emissive)).toBe(true)
      for (const hex of [paper.paper, paper.shade, paper.ink]) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('the bloom cap at rest', () => {
  it('is 0.92 of the bloom threshold', () => {
    expect(REST_CAP).toBeCloseTo(0.92 * BLOOM_THRESHOLD)
  })

  it('rolls everything off below the cap', () => {
    for (const v of [0, 0.5, 1, 1.3, 2, 10, 1e6]) expect(softCap(v)).toBeLessThan(REST_CAP)
    expect(softCap(0.3)).toBe(0.3)
  })

  it('keeps every resting emissive under the cap before the soft knee', () => {
    for (const [name, value] of Object.entries(RESTING_EMISSIVE))
      expect(value, name).toBeLessThan(REST_CAP)
  })
})

/** What three's own physical shader is handed, so a material's `onBeforeCompile` can be run here. */
function compiled(material: THREE.Material) {
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  } as unknown as THREE.WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
  return shader
}

describe('the glass passes', () => {
  const glass = createGlass(GLASS_LOOKS.smoky)

  it('each keep the half of the glass on their side of the liquid, by facing and the inner flag', () => {
    expect(glass.nearTint.defines).toEqual({ NEAR_PASS: 'true' })
    expect(glass.farTint.defines).toEqual({ NEAR_PASS: 'false' })
    for (const tint of [glass.nearTint, glass.farTint] as THREE.ShaderMaterial[]) {
      expect(tint.vertexShader).toContain('vInner = aInner;')
      expect(tint.fragmentShader).toContain('if (potionWrongSide()) discard;')
      expect(tint.fragmentShader).toContain('gl_FrontFacing != potionInner()')
      expect(tint.fragmentShader).not.toContain('uEye')
    }
  })

  it("draw both faces in one pass, so gl_FrontFacing is each face's own facing", () => {
    for (const pass of [glass.nearTint, glass.farTint, glass.nearLight, glass.farLight]) {
      expect(pass.side).toBe(THREE.DoubleSide)
      expect(pass.transparent).toBe(true)
      expect(pass.forceSinglePass).toBe(true)
    }
  })

  it("keep three's own defines on the light passes, and patch every chunk they meant to", () => {
    expect(glass.nearLight.defines).toEqual({ STANDARD: '', PHYSICAL: '', NEAR_PASS: 'true' })
    expect(glass.farLight.defines).toEqual({ STANDARD: '', PHYSICAL: '', NEAR_PASS: 'false' })
    const shader = compiled(glass.nearLight)
    expect(shader.vertexShader).toContain('vInner = aInner;')
    for (const line of [
      'if (potionWrongSide()) discard;',
      'float glassInner = potionInner() ? 1.0 : 0.0;',
      'gl_FragColor = vec4(potionCap(glassCol, uCap), glassA);',
    ])
      expect(shader.fragmentShader).toContain(line)
    expect(shader.fragmentShader).not.toContain('uEye')
  })
})

describe('soft band edges', () => {
  it('blend each boundary over 8 percent of its thinner neighbour, within bounds', () => {
    const edges = bandEdges([20, 50, 90], 5)
    expect(edges).toHaveLength(2)
    expect(edges[0]).toBeCloseTo(0.08 * 15)
    expect(edges[1]).toBeCloseTo(0.08 * 30)
    expect(bandEdges([6, 6.2, 70], 5)[0]).toBeGreaterThan(0)
    expect(Math.max(...bandEdges([200, 400, 600], 0))).toBeLessThanOrEqual(4)
  })

  it('never invert or close up, even over a floor above the first level', () => {
    for (const edge of bandEdges([4, 4, 30], 5)) expect(edge).toBeGreaterThan(0)
  })

  const LAYERED = (Object.keys(BOTTLES) as ShapeId[]).flatMap((shape) =>
    [0, 0.5, 1].flatMap((neck) =>
      [2, 3].map((count) => {
        const pours = (['bluebell', 'starpetal', 'rosehip'] as IngredientId[]).slice(0, count)
        const spec = compilePotion(normalise(potionSchema, { ...withPours(pours), shape, neck }))
        return { name: `${shape} neck ${neck} ${count} pours`, table: levelTable(spec) }
      }),
    ),
  )

  it.each(LAYERED)(
    '$name: stay positive and in order over the floor along up, upright to on its side',
    ({ table }) => {
      for (let deg = 0; deg <= 90; deg++) {
        const t = (deg * Math.PI) / 180
        const levels = levelsAt(table, t)
        const floor = floorAt(table, t)
        const edges = bandEdges(levels, floor)
        expect(edges, `${deg} degrees`).toHaveLength(levels.length - 1)
        expect(floor, `${deg} degrees`).toBeLessThan(levels[0]!)
        expect(floor, `${deg} degrees`).toBeLessThanOrEqual(levels[0]! - edges[0]!)
        edges.forEach((e, i) => {
          expect(e, `${deg} degrees, edge ${i}`).toBeGreaterThan(0)
          if (i + 1 < edges.length)
            expect(levels[i]! + e, `${deg} degrees, edge ${i}`).toBeLessThanOrEqual(
              levels[i + 1]! - edges[i + 1]!,
            )
        })
      }
    },
  )

  it('write into the array they are given, past the levels counted as zero', () => {
    const out = [9, 9, 9]
    expect(bandEdges([20, 50, 90, 140], 5, out, 3)).toBe(out)
    expect(out).toEqual([...bandEdges([20, 50, 90], 5), 0])
  })
})

describe('the liquid', () => {
  it('writes its surface into its uniforms, in place', () => {
    const liquid = createLiquid()
    const levels = liquid.uniforms.uLevels.value
    const edges = liquid.uniforms.uEdges.value
    liquid.setSurface(new THREE.Vector3(0, 0.6, 0.8), [12, 30, 44], 3.5)
    expect(liquid.uniforms.uUp.value.toArray()).toEqual([0, 0.6, 0.8])
    expect(liquid.uniforms.uLevels.value).toEqual([12, 30, 44])
    expect(liquid.uniforms.uCount.value).toBe(3)
    expect(liquid.uniforms.uFloor.value).toBe(3.5)
    expect(liquid.uniforms.uEdges.value).toEqual(bandEdges([12, 30, 44], 3.5))
    liquid.setSurface(new THREE.Vector3(0, 0, 1), [18], 5.3)
    expect(liquid.uniforms.uCount.value).toBe(1)
    expect(liquid.uniforms.uLevels.value).toBe(levels)
    expect(liquid.uniforms.uEdges.value).toBe(edges)
    liquid.dispose()
  })

  it('draws its level surface only in the surface pass, whose faces three draws front facing', () => {
    const liquid = createLiquid()
    expect(liquid.surface.side).toBe(THREE.BackSide)
    expect(liquid.surface.defines).toEqual({ STANDARD: '', PHYSICAL: '', LIQ_SURFACE: 'true' })
    expect(liquid.body.defines).toEqual({ STANDARD: '', PHYSICAL: '', LIQ_SURFACE: 'false' })
    const fragment = compiled(liquid.surface).fragmentShader
    expect(fragment).toContain('bool liqSurface = LIQ_SURFACE && liqEyeH > liqTop;')
    expect(fragment).toContain('if (liqSurface) normal = vUpView;')
    expect(fragment).not.toMatch(/gl_FrontFacing/)
    liquid.dispose()
  })

  it('keeps at most MAX_POURS levels', () => {
    const liquid = createLiquid()
    liquid.setSurface(new THREE.Vector3(0, 0, 1), [1, 2, 3, 4, 5], 0)
    expect(liquid.uniforms.uCount.value).toBe(MAX_POURS)
    expect(liquid.uniforms.uLevels.value).toHaveLength(MAX_POURS)
    liquid.dispose()
  })

  it("writes each band's trait into its uniforms, an ingredient's own variant with it", () => {
    const liquid = createLiquid()
    liquid.setLayers([
      { colour: '#c7b2f0', trait: 'cloud', ingredient: 'moonmilk' },
      { colour: '#7fd6c8', trait: 'swirl', ingredient: 'snailshine' },
      { colour: '#5a4ab8', trait: 'glitter', ingredient: 'thundercloud' },
    ])
    const u = liquid.uniforms
    expect(u.uCloud.value).toEqual([1, 0, 0])
    expect(u.uSwirl.value).toEqual([0, 1, 0])
    expect(u.uPearl.value).toEqual([0, 1, 0])
    expect(u.uFleck.value).toEqual([0, 0, 1])
    expect(u.uGlow.value).toEqual([0, 0, 0])
    const silver = u.uFleckTint.value[2]!.toArray()
    expect(Math.max(...silver) - Math.min(...silver)).toBeLessThan(0.25)
    for (const c of u.uColour.value) expect(rgbInUnit(c.toArray())).toBe(true)
    liquid.setLayers([{ colour: '#f0892a', trait: 'glow' }])
    expect(u.uGlow.value[0]).toBe(1)
    expect(u.uCloud.value[0]).toBe(0)
    expect(u.uCling.value[0]).toBe(0)
    liquid.setLayers([{ colour: '#7ccf4f', trait: 'fizz', ingredient: 'frogfizz' }])
    expect(u.uCling.value[0]).toBe(1)
    liquid.dispose()
  })

  it('has a shader branch for every shading a trait asks for, before the cap', () => {
    const liquid = createLiquid()
    const fragment = compiled(liquid.body).fragmentShader
    for (const trait of TRAITS)
      for (const [name, weight] of Object.entries(traitLook(trait).shading))
        if (weight > 0)
          expect(fragment, `${trait} ${name}`).toMatch(
            new RegExp(`(t|liqTraits)\\.${name} > 0\\.01`),
          )
    expect(fragment.indexOf('liqTraits.glow > 0.01')).toBeLessThan(
      fragment.indexOf('outgoingLight = potionCap(outgoingLight, uCap);'),
    )
    liquid.dispose()
  })

  it("rises the glow's heat along the bottle's own axis, not a clock times the moving up", () => {
    const liquid = createLiquid()
    const fragment = compiled(liquid.body).fragmentShader
    expect(fragment).toContain('potionFbm(liqP * 0.03 - vec3(0.0, 0.0, uTime * 0.12))')
    expect(fragment).not.toMatch(/uUp\s*\*\s*\(?\s*uTime/)
    liquid.dispose()
  })

  it('keeps the glow from inside under the cap on the brightest glowing ingredient', () => {
    const glowing = INGREDIENTS.filter((i) => traitLook(i.trait, i.id).shading.glow > 0)
    expect(glowing.length).toBeGreaterThan(0)
    const peak = Math.max(
      ...glowing.flatMap((i) =>
        srgbToLinear(i.colour).map(
          (c, k) => c * (LIQUID.self + TRAIT_GAIN.glow * TRAIT_GAIN.glowWarm[k]!),
        ),
      ),
    )
    expect(peak).toBeLessThan(REST_CAP)
  })

  it('softens the edge where a cloudy band meets another, still in order', () => {
    const plain = bandEdges([20, 50, 90], 5)
    const soft = bandEdges([20, 50, 90], 5, [], 3, [1, CLOUD_EDGE, 1])
    expect(soft[0]).toBeCloseTo(plain[0]! * CLOUD_EDGE)
    expect(soft[1]).toBeCloseTo(plain[1]! * CLOUD_EDGE)
    expect(bandEdges([20, 50, 90], 5, [], 3, [CLOUD_EDGE, 1, 1])[1]).toBeCloseTo(plain[1]!)
    for (const edge of bandEdges([6, 6.4, 30], 5, [], 3, [CLOUD_EDGE, CLOUD_EDGE, CLOUD_EDGE]))
      expect(edge).toBeLessThanOrEqual(0.45 * 0.4 + 1e-9)
  })

  it("softens a cloudy band's edges once its layers are set", () => {
    const liquid = createLiquid()
    liquid.setLayers([
      { colour: '#d42c2c', trait: 'cloud', ingredient: 'puffcap' },
      { colour: '#5b8def', trait: 'clear' },
      { colour: '#5b8def', trait: 'clear' },
    ])
    liquid.setSurface(new THREE.Vector3(0, 0, 1), [20, 50, 90], 5)
    expect(liquid.uniforms.uEdges.value).toEqual(
      bandEdges([20, 50, 90], 5, [], 3, [CLOUD_EDGE, 1, 1]),
    )
    liquid.dispose()
  })
})

describe("the liquid's mix", () => {
  const RECIPES = INGREDIENTS.flatMap((a) =>
    INGREDIENTS.flatMap((b) => INGREDIENTS.map((c) => [a.id, b.id, c.id] as unknown as Recipe)),
  )

  it('is written into uniforms both passes hold, in place', () => {
    const liquid = createLiquid()
    const u = liquid.uniforms
    const held = [u.uMix, u.uVortex, u.uSpin]
    expect([u.uMix.value, u.uVortex.value, u.uSpin.value]).toEqual([0, 0, 0])
    liquid.setMix(0.4, 0.8, 2.5)
    expect([u.uMix.value, u.uVortex.value, u.uSpin.value]).toEqual([0.4, 0.8, 2.5])
    liquid.setMix(1, 0)
    expect([u.uMix.value, u.uVortex.value, u.uSpin.value]).toEqual([1, 0, 0])
    for (const pass of [liquid.surface, liquid.body]) {
      const shader = compiled(pass)
      expect([shader.uniforms.uMix, shader.uniforms.uVortex, shader.uniforms.uSpin]).toEqual(held)
      expect(shader.uniforms.uMixColour).toBe(u.uMixColour)
    }
    liquid.dispose()
  })

  it("takes the mix's colour and trait, its main ingredient's variant with it, beside the layers", () => {
    const liquid = createLiquid()
    const u = liquid.uniforms
    liquid.setLayers([{ colour: '#f0892a', trait: 'glow' }])
    liquid.setMixed({ colour: '#7d6cc9', trait: 'glitter', ingredient: 'thundercloud' })
    expect(u.uMixColour.value.toArray()).toEqual(srgbToLinear('#7d6cc9'))
    expect([u.uMixFleck.value, u.uMixGlow.value, u.uMixCloud.value]).toEqual([1, 0, 0])
    const silver = u.uMixFleckTint.value.toArray()
    expect(Math.max(...silver) - Math.min(...silver)).toBeLessThan(0.25)
    expect(u.uGlow.value[0]).toBe(1)
    liquid.setMixed({ colour: '#655e40', trait: 'murk', ingredient: null })
    expect([u.uMixFleck.value, u.uMixCloud.value]).toEqual([0, traitLook('murk').shading.cloud])
    liquid.setMixed({ colour: '#cd94e2', trait: 'swirl', ingredient: 'snailshine' })
    expect([u.uMixSwirl.value, u.uMixPearl.value, u.uMixCling.value]).toEqual([1, 1, 0])
    liquid.setMixed(null)
    expect([u.uMixSwirl.value, u.uMixPearl.value, u.uMixCloud.value]).toEqual([0, 0, 0])
    liquid.dispose()
  })

  it('blends the colour and every trait towards the mix by one weight, the bands read through the vortex', () => {
    const fragment = compiled(createLiquid().body).fragmentShader
    expect(fragment).toContain('vec3 liqLayered = potionBand(liqBandH, liqTraits);')
    expect(fragment).toMatch(
      /liqTraits = potionTraitsMix\(liqTraits, PotionTraits\(uMixCloud, .*uMixCling\), liqMixed\);/,
    )
    expect(fragment).toContain('mix(liqLayered, uMixColour, liqMixed)')
    expect(fragment).toContain('if (uVortex > 0.0) {')
  })

  it('keeps the vortex off the page clock, and its numbers the ones its twin uses', () => {
    const fragment = compiled(createLiquid().body).fragmentShader
    const from = fragment.indexOf('vec2 potionVortex(')
    const vortex = fragment.slice(from, fragment.indexOf('\n}', from))
    const g = (v: number) => v.toFixed(4)
    expect(vortex).not.toContain('uTime')
    expect(vortex).toContain(`float a = ${g(VORTEX.pitch)} * h + ${g(VORTEX.radial)} * r - uSpin;`)
    expect(vortex).toContain(`float lobe = q.x / max(r, ${g(VORTEX.axisMm)});`)
    expect(vortex).toContain(`uVortex * span * (${g(VORTEX.reach)} * lobe`)
    const main = fragment.slice(fragment.indexOf('float liqMixed = uMix;'))
    expect(main.slice(0, main.indexOf('vec3 liqLayered'))).not.toContain('uTime')
  })

  it('carries nothing at rest and never further than its reach', () => {
    for (const p of [
      [12, 0, 30],
      [0, -9, 55],
      [0.01, 0, 20],
      [0, 0, 20],
    ] as const) {
      expect(Math.abs(vortexShift(p, p[2], 60, 0, 7))).toBe(0)
      for (let spin = 0; spin < 13; spin += 0.37)
        expect(Math.abs(vortexShift(p, p[2], 60, 1, spin))).toBeLessThanOrEqual(
          60 * VORTEX.reach + 1e-9,
        )
    }
    expect(vortexShift([0, 0, 20], 20, 60, 1, 1)).toBe(0)
  })

  it('winds smoothly an hour after the page opened, while the surface sloshes', () => {
    const FRAME = 1 / 60
    const p = [14, 6, 40] as const
    const run = (start: number) => {
      const player = new PotionShowPlayer()
      player.play(start, { firstMix: true, full: true, reducedMotion: false })
      return Array.from({ length: Math.round(SHOW_BEATS.pop / FRAME) }, (_, i) => {
        const t = i * FRAME
        const show = player.draw(start + t, 0)
        // A 12 degree slosh, one swing in 0.6 s: the up, the height along it and the liquid's span all move.
        const lean = ((12 * Math.PI) / 180) * Math.sin((2 * Math.PI * t) / 0.6)
        const h = p[2] * Math.cos(lean) + p[0] * Math.sin(lean)
        const span = 60 + 4 * Math.sin((2 * Math.PI * t) / 0.6)
        return vortexShift(p, h, span, show.swirl, show.spin)
      })
    }
    const late = run(3600)
    for (let i = 1; i < late.length; i++)
      expect(Math.abs(late[i]! - late[i - 1]!), `frame ${i}`).toBeLessThan(6.5)
    const early = run(0)
    late.forEach((shift, i) => expect(shift).toBeCloseTo(early[i]!, 6))
    expect(Math.max(...late.map(Math.abs))).toBeGreaterThan(10)
  })

  it('is fully mixed, the vortex still, before the stopper pops', () => {
    for (let t = SHOW_BEATS.twist; t <= SHOW_BEATS.pop; t += 1 / 120) {
      const show = potionShow(t, { firstMix: true, full: true, reducedMotion: false })
      expect([show.mix, show.swirl]).toEqual([1, 0])
    }
  })

  it('keeps the glow from inside under the cap on the brightest glowing mix', () => {
    const glowing = RECIPES.map(mixPotion).filter(
      (m) => traitLook(m.trait, m.main).shading.glow > 0,
    )
    expect(glowing.length).toBeGreaterThan(0)
    const peak = Math.max(
      ...glowing.flatMap((m) =>
        srgbToLinear(m.colour).map(
          (c, k) => c * (LIQUID.self + TRAIT_GAIN.glow * TRAIT_GAIN.glowWarm[k]!),
        ),
      ),
    )
    expect(peak).toBeLessThan(REST_CAP)
    const fragment = compiled(createLiquid().body).fragmentShader
    expect(fragment.indexOf('uMixGlow')).toBeLessThan(
      fragment.indexOf('outgoingLight = potionCap(outgoingLight, uCap);'),
    )
  })
})

describe('the liquid clock', () => {
  it('runs with the frames', () => {
    const clock = new LiquidClock({ frozenAt: null, still: false })
    clock.tick(0.5)
    clock.tick(0.25)
    expect(clock.time).toBeCloseTo(0.75)
  })

  it('does not advance under reduced motion', () => {
    const clock = new LiquidClock({ frozenAt: null, still: true })
    clock.tick(0.5)
    expect(clock.time).toBe(0)
  })

  it('holds a frozen moment', () => {
    const clock = new LiquidClock({ frozenAt: 1.2, still: false })
    clock.tick(0.5)
    expect(clock.time).toBe(1.2)
  })

  it('reads ?freeze only on a dev server', () => {
    expect(freezeFrom('?freeze=1.2', true)).toBe(1.2)
    expect(freezeFrom('?clay&freeze=0', true)).toBe(0)
    expect(freezeFrom('?freeze=1.2', false)).toBeNull()
    expect(freezeFrom('', true)).toBeNull()
    expect(freezeFrom('?freeze=soon', true)).toBeNull()
  })
})

describe('label ink', () => {
  it('splits a name into balanced lines', () => {
    expect(labelLines('Moonmilk, Rosehip and Starpetal', 3)).toEqual([
      'Moonmilk,',
      'Rosehip and',
      'Starpetal',
    ])
    expect(labelLines('Moonmilk, Rosehip and Starpetal', 2)).toEqual([
      'Moonmilk, Rosehip',
      'and Starpetal',
    ])
    expect(labelLines('Pure Moonmilk', 3)).toEqual(['Pure', 'Moonmilk'])
    expect(labelLines('Puffcap', 3)).toEqual(['Puffcap'])
  })

  it('marks a tag card as paper and its string as not', () => {
    const spec = compilePotion(
      normalise(potionSchema, { ...withPours(['moonmilk']), shape: 'teardrop', label: 'tag' }),
    )
    const label = buildPotionMesh(spec).label!
    const mask = paperMask(label, true)
    const string = mask.filter((m) => m === 0).length
    expect(string).toBe(tagLayout(bottleProfile(spec)).string.length * 8)
    expect(mask.length - string).toBeGreaterThan(0)
    const round = buildPotionMesh({ ...spec, label: 'round' }).label!
    expect(paperMask(round, false).every((m) => m === 1)).toBe(true)
  })
})
