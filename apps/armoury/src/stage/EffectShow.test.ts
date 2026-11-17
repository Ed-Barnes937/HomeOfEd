import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { PotionEffect } from '../potion/effects.ts'
import { effectCount, effectParticle, MAX_POINTS, newParticle } from './effectKinds.ts'
import { createField } from './EffectShow.tsx'
import { REST_CAP } from './potionMaterials.ts'
import { EFFECT_CAP, type PotionShow, showRest } from './potionShow.ts'

const HEIGHT = 640
const camera = new THREE.PerspectiveCamera(35, 360 / HEIGHT, 0.1, 50)
camera.position.set(0, 0, 8)
camera.updateProjectionMatrix()
camera.updateMatrixWorld()

const effect: PotionEffect = { kind: 'sparkling', strength: 3, colours: ['#47d0be', '#7fd6c8'] }
const shown = { effect, seed: 7, bottle: 1.9 }
const count = effectCount(effect.kind, effect.strength)

const mouthAt = (x: number, y: number) => {
  const mouth = new THREE.Object3D()
  mouth.position.set(x, y, 0)
  mouth.updateMatrixWorld()
  return mouth
}
const A = mouthAt(0, 0.9)
const B = mouthAt(0.5, 1.1)

const during = (age: number, emit = 1): PotionShow => ({
  ...showRest(1),
  popped: true,
  emit,
  age,
  cap: REST_CAP + (EFFECT_CAP - REST_CAP) * emit,
})

const draw = (field: ReturnType<typeof createField>, show: PotionShow, mouth: THREE.Object3D) =>
  field.draw(show, shown, mouth, camera, HEIGHT, 2)

const drawn = (field: ReturnType<typeof createField>) => {
  const position = field.geometry.getAttribute('position').array
  const look = field.geometry.getAttribute('aLook').array
  return Array.from({ length: MAX_POINTS }, (_, i) => ({
    i,
    alpha: look[i * 4 + 1]!,
    at: [position[i * 3]!, position[i * 3 + 1]!, position[i * 3 + 2]!],
  }))
}
const visible = (field: ReturnType<typeof createField>) => drawn(field).filter((p) => p.alpha > 0)
const outBy = (age: number) => {
  const p = newParticle()
  return Array.from(
    { length: count },
    (_, i) => effectParticle(effect.kind, shown.seed, i, age, effect.strength, p).born,
  )
}

describe('the effect as it is drawn', () => {
  it('draws nothing at rest, and nothing once the show is over', () => {
    const field = createField()
    draw(field, showRest(1), A)
    expect(visible(field)).toHaveLength(0)
    draw(field, during(0.8), A)
    expect(visible(field).length).toBeGreaterThan(20)
    draw(field, showRest(1), A)
    expect(visible(field)).toHaveLength(0)
  })

  it('leaves what is out where it is when the bottle moves, and lets the rest out from where the neck is now', () => {
    const moved = createField()
    const stayed = createField()
    const there = createField()
    for (const field of [moved, stayed]) draw(field, during(0.5), A)
    draw(there, during(0.5), B)
    draw(moved, during(0.5), B)
    expect(drawn(moved)).toEqual(drawn(stayed))

    for (const [field, mouth] of [
      [moved, B],
      [stayed, A],
      [there, B],
    ] as const)
      draw(field, during(0.9), mouth)
    const early = outBy(0.5)
    const [m, s, t] = [drawn(moved), drawn(stayed), drawn(there)]
    let kept = 0
    let fresh = 0
    for (let i = 0; i < count; i++) {
      if (!(m[i]!.alpha > 0)) continue
      expect(m[i], `#${i}`).toEqual(early[i] ? s[i] : t[i])
      if (early[i]) kept++
      else fresh++
    }
    expect(kept).toBeGreaterThan(10)
    expect(fresh).toBeGreaterThan(10)
  })

  it('starts every pop from where the neck is then', () => {
    const again = createField()
    const first = createField()
    draw(again, during(1.5), A)
    draw(again, showRest(1), A)
    draw(again, during(0.3), B)
    draw(first, during(0.3), B)
    expect(visible(first).length).toBeGreaterThan(5)
    expect(visible(again)).toEqual(visible(first))
    const restarted = createField()
    draw(restarted, during(1.5), A)
    draw(restarted, during(0.3), B)
    expect(visible(restarted)).toEqual(visible(first))
  })

  it('fades with the show and lifts its cap only as far as the show says', () => {
    const field = createField()
    expect(field.material.uniforms.uCap!.value).toBe(REST_CAP)
    draw(field, during(0.8), A)
    const full = visible(field)
    expect(field.material.uniforms.uCap!.value).toBe(EFFECT_CAP)
    draw(field, during(0.8, 0.25), A)
    const faded = visible(field)
    expect(faded).toHaveLength(full.length)
    for (const [k, p] of faded.entries()) expect(p.alpha).toBeCloseTo(full[k]!.alpha * 0.25, 6)
    expect(field.material.uniforms.uCap!.value).toBeLessThan(EFFECT_CAP)
  })

  it('keeps every particle on screen with the neck hard by either edge', () => {
    const v = new THREE.Vector3()
    for (const x of [-1.3, 1.3]) {
      const field = createField()
      const mouth = mouthAt(x, 1.6)
      for (const age of [0.2, 0.6, 1.2, 1.8]) {
        draw(field, during(age), mouth)
        for (const p of visible(field)) {
          v.fromArray(p.at).project(camera)
          expect(Math.abs(v.x), `#${p.i} at ${age}`).toBeLessThan(1)
          expect(v.y, `#${p.i} at ${age}`).toBeLessThan(1)
        }
      }
    }
  })

  it('keeps the canvas premultiplied: each sprite covers at least its own light, blended over', () => {
    const { material } = createField()
    expect(material.blending).toBe(THREE.CustomBlending)
    expect([
      material.blendSrc,
      material.blendDst,
      material.blendSrcAlpha,
      material.blendDstAlpha,
    ]).toEqual([
      THREE.OneFactor,
      THREE.OneMinusSrcAlphaFactor,
      THREE.OneFactor,
      THREE.OneMinusSrcAlphaFactor,
    ])
    expect(material.fragmentShader).toContain(
      'gl_FragColor = vec4(lit, max(a * cover, max(max(lit.r, lit.g), lit.b)));',
    )
  })

  it('never grows its buffers', () => {
    const field = createField()
    const before = field.geometry.getAttribute('position').array
    for (const age of [0.1, 0.9, 2.4]) draw(field, during(age), A)
    expect(field.geometry.getAttribute('position').array).toBe(before)
    expect(before).toHaveLength(MAX_POINTS * 3)
  })
})
