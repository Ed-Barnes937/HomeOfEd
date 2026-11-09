import * as THREE from 'three'
import { describe, expect, test } from 'vitest'

import { WAVE_TO_SPELL_SECONDS } from './stage.ts'
import { EIGHT, fitWave, WAVE_SECONDS, wavePose, waveTurn } from './wave.ts'

const STEP = 1 / 240
const times = Array.from({ length: Math.ceil(WAVE_SECONDS / STEP) + 1 }, (_, i) =>
  Math.min(i * STEP, WAVE_SECONDS),
)
const samples = times.map(wavePose)
const during = (from: number, to: number) =>
  samples.filter((_, i) => times[i]! >= from && times[i]! <= to)

describe('waving the wand', () => {
  test('starts and ends at rest', () => {
    for (const pose of [wavePose(0), wavePose(WAVE_SECONDS), wavePose(WAVE_SECONDS + 1)])
      for (const n of [pose.aim, pose.side, pose.rise]) expect(n).toBeCloseTo(0, 6)
  })

  test('never jumps from one frame to the next', () => {
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1]!, samples[i]!]
      for (const key of ['aim', 'side', 'rise'] as const)
        expect(Math.abs(b[key] - a[key])).toBeLessThan(0.05)
    }
  })

  test('aims away from the viewer for the whole figure of 8', () => {
    for (const p of during(EIGHT.from, EIGHT.to)) expect(p.aim).toBe(1)
  })

  test('the tip draws a figure of 8: out to each side, over and under on each', () => {
    const eight = during(EIGHT.from, EIGHT.to)
    for (const side of [1, -1]) {
      const lobe = eight.filter((p) => p.side * side > 0.05)
      expect(Math.max(...lobe.map((p) => p.side * side))).toBeGreaterThan(0.99)
      expect(lobe.some((p) => p.rise > 0.5)).toBe(true)
      expect(lobe.some((p) => p.rise < -0.5)).toBe(true)
    }
  })

  test('takes a couple of seconds over the 8', () => {
    expect(EIGHT.to - EIGHT.from).toBeGreaterThanOrEqual(2)
  })

  test('leaves a streak only while drawing the 8', () => {
    expect(wavePose(EIGHT.from / 2).trail).toBe(false)
    expect(wavePose((EIGHT.from + EIGHT.to) / 2).trail).toBe(true)
    expect(wavePose(EIGHT.to + 0.01).trail).toBe(false)
  })

  test('casts as the 8 closes, then only settles back', () => {
    expect(EIGHT.to).toBe(WAVE_TO_SPELL_SECONDS)
    const after = during(WAVE_TO_SPELL_SECONDS, WAVE_SECONDS)
    for (const [i, p] of after.entries()) {
      expect(Math.abs(p.side) + Math.abs(p.rise)).toBeLessThan(1e-9)
      if (i > 0) expect(p.aim).toBeLessThanOrEqual(after[i - 1]!.aim)
    }
  })
})

describe('fitting the 8 to the screen', () => {
  const FOV = 26
  const DISTANCE = 8

  // The wand as the close look holds it on a screen this size.
  function heldWand(width: number, height: number) {
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 50)
    camera.position.set(0, 0, DISTANCE)
    camera.updateMatrixWorld()
    const px = height / (2 * DISTANCE * Math.tan((FOV * Math.PI) / 360))
    const tilt = height > width ? Math.PI * 0.4 : Math.PI * 0.05
    const length = 3.3
    const scale = Math.min(
      (0.76 * width) / (length * px * Math.cos(tilt)),
      (0.56 * height) / (length * px * Math.sin(tilt)),
    )
    const along = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0)
    const grip = new THREE.Vector3(0, (0.1 * height) / px, 0).addScaledVector(
      along,
      -0.3 * length * scale,
    )
    const reach = along.clone().multiplyScalar(0.8 * length * scale)
    const across = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0)
    return { camera, grip, reach, across }
  }

  function tipPath(wand: ReturnType<typeof heldWand>, size: number) {
    const turn = new THREE.Quaternion()
    return Array.from({ length: 400 }, (_, i) => {
      const phi = (2 * Math.PI * i) / 400
      waveTurn(
        { aim: 1, side: Math.sin(phi), rise: Math.sin(2 * phi), trail: true },
        wand.across,
        size,
        turn,
      )
      return wand.reach.clone().applyQuaternion(turn).add(wand.grip).project(wand.camera)
    })
  }

  test('a laptop screen has room for the whole 8', () => {
    const wand = heldWand(1440, 900)
    expect(fitWave(wand.camera, wand.grip, wand.reach, wand.across)).toBe(1)
  })

  test('the 8 is wide: it sweeps across a good part of the screen', () => {
    const wand = heldWand(1440, 900)
    const xs = tipPath(wand, 1).map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.8)
  })

  test.each([
    [1440, 900],
    [1024, 768],
    [844, 390],
    [390, 844],
    [360, 640],
    [768, 1024],
  ])('keeps the tip on a %ix%i screen', (width, height) => {
    const wand = heldWand(width, height)
    const size = fitWave(wand.camera, wand.grip, wand.reach, wand.across)
    for (const p of tipPath(wand, size)) {
      expect(Math.abs(p.x)).toBeLessThan(0.95)
      expect(Math.abs(p.y)).toBeLessThan(0.95)
    }
  })

  test('shrinks the 8 on a narrow phone rather than leaving the screen', () => {
    const wand = heldWand(390, 844)
    expect(tipPath(wand, 1).some((p) => Math.abs(p.x) > 0.88)).toBe(true)
    expect(fitWave(wand.camera, wand.grip, wand.reach, wand.across)).toBeLessThan(1)
  })
})
