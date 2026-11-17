import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compilePotion } from '../potion/compile.ts'
import { bottleProfile, LIQUID_GAP_MM } from '../potion/profile.ts'
import { MAX_POURS, potionSchema } from '../potion/potionSchema.ts'
import { withPours } from '../potion/pours.ts'
import {
  BUBBLE_FADE_IN,
  BUBBLE_FADE_OUT,
  BUBBLE_SPEED,
  BUBBLE_SWAY,
  cavityRadii,
  MAX_MOTES,
  MOTE_PROGRAMS,
  MOTE_TURN,
  motePool,
  SPECK_FADE,
  SPECK_SPEED,
  TRAIT_LOOKS,
} from '../potion/traits.ts'
import { createMotes, MOTE_RADII, motesGeometry } from './LiquidMotes.tsx'
import { createLiquid } from './potionMaterials.ts'

describe("the liquid's motes", () => {
  it("run on the liquid's own clock and bands, so reduced motion and a frozen shot hold them", () => {
    const liquid = createLiquid()
    const motes = createMotes(liquid.uniforms)
    for (const name of [
      'uTime',
      'uUp',
      'uLevels',
      'uEdges',
      'uCount',
      'uFloor',
      'uColour',
      'uCap',
      'uMix',
      'uMixColour',
    ])
      expect(motes.uniforms[name], name).toBe(liquid.uniforms[name])
    expect(motes.material.vertexShader).not.toMatch(/performance|Date/)
    motes.dispose()
    liquid.dispose()
  })

  it("draw a bubble's rise, sway and fade from the numbers `bubbleAt` uses", () => {
    const motes = createMotes(createLiquid().uniforms)
    const g = (v: number) => v.toFixed(4)
    const vertex = motes.material.vertexShader
    expect(vertex).toContain(
      `fract(aSeed.y + t * (${g(BUBBLE_SPEED.base)} + ${g(BUBBLE_SPEED.spread)} * aSeed.z) / riseMm)`,
    )
    expect(vertex).toContain(
      `${g(BUBBLE_SWAY.mm)} * sin(t * ${g(BUBBLE_SWAY.rate)} + aSeed.w * ${g(BUBBLE_SWAY.phase)}) * rise`,
    )
    expect(vertex).toContain(
      `smoothstep(0.0, ${g(BUBBLE_FADE_IN)}, rise) * (1.0 - smoothstep(${g(BUBBLE_FADE_OUT)}, 1.0, rise))`,
    )
    motes.dispose()
  })

  it("give each band its trait's program, share and colour; none where the trait has no motes", () => {
    const motes = createMotes(createLiquid().uniforms)
    motes.setLayers([
      { colour: '#7ccf4f', trait: 'fizz', ingredient: 'frogfizz' },
      { colour: '#5a4ab8', trait: 'glitter', ingredient: 'thundercloud' },
      { colour: '#d42c2c', trait: 'cloud', ingredient: 'puffcap' },
    ])
    const u = motes.uniforms
    expect(u.uKind.value).toEqual([
      MOTE_PROGRAMS.bubble.code,
      MOTE_PROGRAMS.fleck.code,
      MOTE_PROGRAMS.spore.code,
    ])
    expect(u.uDensity.value).toEqual([
      MOTE_PROGRAMS.bubble.density,
      MOTE_PROGRAMS.fleck.density,
      MOTE_PROGRAMS.spore.density,
    ])
    const silver = u.uTint.value[1]!.toArray()
    expect(Math.max(...silver) - Math.min(...silver)).toBeLessThan(0.25)
    motes.setLayers([{ colour: '#c7b2f0', trait: 'cloud', ingredient: 'moonmilk' }])
    expect(u.uKind.value).toEqual([0, 0, 0])
    expect(u.uDensity.value).toEqual([0, 0, 0])
    motes.dispose()
  })

  it("give the mix its trait's program over the whole liquid, timed on a full bottle's height", () => {
    const motes = createMotes(createLiquid().uniforms)
    const u = motes.uniforms
    expect([u.uMixKind.value, u.uMixDensity.value]).toEqual([0, 0])
    motes.setMixed({ colour: '#655e40', trait: 'murk', ingredient: null })
    expect(u.uMixKind.value).toBe(MOTE_PROGRAMS.speck.code)
    expect(u.uMixDensity.value).toBe(MOTE_PROGRAMS.speck.density)
    expect(u.uMixTint.value.toArray()).toEqual(new THREE.Color(TRAIT_LOOKS.murk.tint!).toArray())
    motes.setMixed({ colour: '#65d286', trait: 'fizz', ingredient: 'frogfizz' })
    expect(u.uMixKind.value).toBe(MOTE_PROGRAMS.bubble.code)
    motes.setMixed(null)
    expect([u.uMixKind.value, u.uMixDensity.value]).toEqual([0, 0])
    const vertex = motes.material.vertexShader
    expect(vertex).toContain(`riseMm = uRise * ${MAX_POURS}.0;`)
    expect(vertex).toContain('lo = uFloor;')
    expect(vertex).toContain('hi = uLevels[uCount - 1];')
    motes.dispose()
  })

  it("change each mote over, and sink a murk's specks, by the numbers their twins use", () => {
    const motes = createMotes(createLiquid().uniforms)
    const g = (v: number) => v.toFixed(4)
    const vertex = motes.material.vertexShader
    expect(vertex).toContain(
      `float turnAt = ${g(MOTE_TURN.from)} + ${g(MOTE_TURN.span)} * fract(aSeed.w * 13.0 + aSeed.y * 7.0);`,
    )
    expect(vertex).toContain(`smoothstep(0.0, ${g(MOTE_TURN.fade)}, abs(uMix - turnAt))`)
    expect(vertex).toContain(
      `fract(aSeed.y + t * (${g(SPECK_SPEED.base)} + ${g(SPECK_SPEED.spread)} * aSeed.z) / riseMm)`,
    )
    expect(vertex).toContain(
      `smoothstep(0.0, ${g(SPECK_FADE.in)}, fall) * (1.0 - smoothstep(${g(SPECK_FADE.out)}, 1.0, fall))`,
    )
    expect(vertex).not.toMatch(/\bt\s*\*[^;]*\b(uLevels|uUp|uEdges|hi|lo|span)\b/)
    motes.dispose()
  })

  it('draw at most the pool, in one draw of points that writes no depth', () => {
    const profile = bottleProfile(
      compilePotion(normalise(potionSchema, { ...withPours(['starpetal']), shape: 'round' })),
    )
    const geometry = motesGeometry(motePool(profile))
    expect(geometry.drawRange.count).toBeLessThanOrEqual(MAX_MOTES)
    expect(geometry.getAttribute('aSeed').itemSize).toBe(4)
    const motes = createMotes(createLiquid().uniforms)
    expect(motes.material.depthWrite).toBe(false)
    expect(motes.material.depthTest).toBe(true)
    expect(motes.material.blending).toBe(THREE.CustomBlending)
    const cavity = cavityRadii(profile, MOTE_RADII, LIQUID_GAP_MM)
    motes.setCavity(cavity)
    expect(motes.uniforms.uRise.value).toBe(cavity.rise)
    expect(cavity.rise).toBeGreaterThan(5)
    expect(cavity.rise).toBeLessThan(profile.fullZ)
    expect(motes.uniforms.uRadius.value).toHaveLength(MOTE_RADII)
    expect(Math.max(...motes.uniforms.uRadius.value)).toBeLessThan(profile.widthMm / 2)
    motes.dispose()
  })
})
