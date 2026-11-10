import { describe, expect, it } from 'vitest'

import {
  computeNormals,
  inwardNormals,
  merge,
  type MeshPart,
  openEdges,
  signedVolume,
  type Station,
  sweep,
} from './sweep.ts'

function expectSound(part: MeshPart): void {
  expect(openEdges(part)).toBe(0)
  expect(signedVolume(part)).toBeGreaterThan(0)
  expect(inwardNormals(part)).toBe(0)
}

const square = (half: number) =>
  new Float32Array([half, -half, half, half, -half, half, -half, -half])
const circle = (r: number, n: number) => {
  const s = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    s[i * 2] = r * Math.cos((2 * Math.PI * i) / n)
    s[i * 2 + 1] = r * Math.sin((2 * Math.PI * i) / n)
  }
  return s
}
const station = (z: number, section: Float32Array): Station => ({
  centre: [0, 0, z],
  axisU: [1, 0, 0],
  axisV: [0, 1, 0],
  section,
  uvAlong: z,
})

const box = () =>
  sweep([station(0, square(5)), station(4, square(5)), station(10, square(5))], {
    capStart: 'fan',
    capEnd: 'fan',
    seam: false,
  })
const cone = (seam: boolean) =>
  sweep(
    [
      station(0, circle(4, 24)),
      station(5, circle(3, 24)),
      station(12, circle(2, 24)),
      station(20, new Float32Array()),
    ],
    { capStart: 'fan', capEnd: 'apex', seam },
  )

describe('sweep', () => {
  it('sweeps a closed box with the right volume and flat faces', () => {
    const part = box()
    expectSound(part)
    expect(signedVolume(part)).toBeCloseTo(1000, 3)
    // Split caps: a cap vertex points straight back, a side vertex never does.
    const n = part.normals
    let back = 0
    for (let k = 0; k < n.length; k += 3) if (n[k + 2]! < -0.999) back++
    expect(back).toBeGreaterThanOrEqual(4)
  })

  it.each([false, true])('sweeps a closed cone to an apex (seam %s)', (seam) => {
    const part = cone(seam)
    expectSound(part)
  })

  it('winds outward whichever way the section runs', () => {
    const cw = (s: Float32Array) => {
      const out = new Float32Array(s.length)
      for (let i = 0; i < s.length / 2; i++) {
        out[i * 2] = s[(s.length / 2 - 1 - i) * 2]!
        out[i * 2 + 1] = s[(s.length / 2 - 1 - i) * 2 + 1]!
      }
      return out
    }
    const part = sweep([station(0, cw(square(5))), station(10, cw(square(5)))], {
      capStart: 'fan',
      capEnd: 'fan',
      seam: false,
    })
    expectSound(part)
    expect(signedVolume(part)).toBeCloseTo(1000, 3)
  })

  it('carries station attributes and lays uv along and across in mm', () => {
    const s = (z: number): Station => ({
      ...station(z, square(5)),
      attrs: { aAlong: new Float32Array(4).fill(z / 10) },
    })
    const part = sweep([s(0), s(10)], { capStart: 'fan', capEnd: 'fan', seam: false })
    const along = part.attrs.aAlong!
    expect(along).toHaveLength(part.positions.length / 3)
    expect(Math.min(...along)).toBe(0)
    expect(Math.max(...along)).toBe(1)
    const vs = part.uvs.filter((_, i) => i % 2 === 1)
    expect(Math.max(...vs)).toBe(10)
    const seamed = cone(true)
    const us = seamed.uvs.filter((_, i) => i % 2 === 0)
    expect(Math.max(...us)).toBeGreaterThan(2 * Math.PI * 4 * 0.98)
  })

  it('merges parts and stays closed', () => {
    const shifted = cone(false)
    for (let k = 0; k < shifted.positions.length; k += 3) shifted.positions[k]! += 30
    const part = merge([box(), shifted])
    expectSound(part)
    expect(signedVolume(part)).toBeCloseTo(signedVolume(box()) + signedVolume(cone(false)), 2)
  })

  it('recomputes normals after a bend', () => {
    const part = box()
    for (let k = 0; k < part.positions.length; k += 3) {
      const z = part.positions[k + 2]!
      part.positions[k]! += 0.02 * z * z
    }
    computeNormals(part)
    expectSound(part)
  })
})
