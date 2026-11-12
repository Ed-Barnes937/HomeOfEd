import * as THREE from 'three'
import { expect, test, vi } from 'vitest'

import {
  latestOnly,
  prepareSwordTextures,
  SWORD_TEXTURES,
  type SwordTextures,
} from './SwordMesh.tsx'

test("the sword's maps are set up as they load, colour maps in sRGB and data maps raw", () => {
  const textures = Object.fromEntries(
    Object.keys(SWORD_TEXTURES).map((key) => [key, new THREE.Texture()]),
  ) as SwordTextures
  prepareSwordTextures(textures)
  for (const [key, texture] of Object.entries(textures)) {
    const colour = SWORD_TEXTURES[key as keyof SwordTextures].endsWith('-colour.webp')
    expect(texture.colorSpace, key).toBe(colour ? THREE.SRGBColorSpace : THREE.NoColorSpace)
    expect(texture.wrapS, key).toBe(THREE.RepeatWrapping)
    expect(texture.wrapT, key).toBe(THREE.RepeatWrapping)
    expect(texture.anisotropy, key).toBe(8)
  }
})

test('a burst of slider moves builds once, on the next frame, from the latest', () => {
  const frames: (() => void)[] = []
  const build = vi.fn((n: number) => n * 10)
  const built = vi.fn()
  const builder = latestOnly(build, built, {
    request: (f) => frames.push(f),
    cancel: () => frames.splice(0),
  })
  builder.request(1)
  builder.request(2)
  builder.request(3)
  expect(build).not.toHaveBeenCalled()
  expect(frames).toHaveLength(1)
  frames.shift()!()
  expect(build).toHaveBeenCalledExactlyOnceWith(3)
  expect(built).toHaveBeenCalledExactlyOnceWith(30)

  builder.request(4)
  builder.cancel()
  expect(frames).toHaveLength(0)
  expect(build).toHaveBeenCalledTimes(1)
})
