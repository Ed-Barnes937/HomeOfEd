import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { compilePotion } from '../potion/compile.ts'
import { bottleProfile, LIQUID_GAP_MM } from '../potion/profile.ts'
import { potionSchema } from '../potion/potionSchema.ts'
import { withPours } from '../potion/pours.ts'
import { cavityRadii, MAX_MOTES, MOTE_PROGRAMS, motePool } from '../potion/traits.ts'
import { createMotes, MOTE_RADII, motesGeometry } from './LiquidMotes.tsx'
import { createLiquid } from './potionMaterials.ts'

describe("the liquid's motes", () => {
  it("run on the liquid's own clock and bands, so reduced motion and a frozen shot hold them", () => {
    const liquid = createLiquid()
    const motes = createMotes(liquid.uniforms)
    for (const name of ['uTime', 'uUp', 'uLevels', 'uEdges', 'uCount', 'uFloor', 'uColour', 'uCap'])
      expect(motes.uniforms[name], name).toBe(liquid.uniforms[name])
    expect(motes.material.vertexShader).not.toMatch(/performance|Date/)
    motes.dispose()
    liquid.dispose()
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
    motes.setCavity(cavityRadii(profile, MOTE_RADII, LIQUID_GAP_MM))
    expect(motes.uniforms.uRadius.value).toHaveLength(MOTE_RADII)
    expect(Math.max(...motes.uniforms.uRadius.value)).toBeLessThan(profile.widthMm / 2)
    motes.dispose()
  })
})
