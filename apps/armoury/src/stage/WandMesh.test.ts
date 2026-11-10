import * as THREE from 'three'
import { expect, test } from 'vitest'

import { prepareWoodTextures, texturePaths } from './WandMesh.tsx'

test("every wood's maps are set up as they load, not when the wood is first chosen", () => {
  const textures = texturePaths.map(() => new THREE.Texture())
  prepareWoodTextures(textures)
  textures.forEach((texture, i) => {
    const colour = texturePaths[i]!.endsWith('-colour.webp')
    expect(texture.colorSpace).toBe(colour ? THREE.SRGBColorSpace : THREE.NoColorSpace)
    expect(texture.wrapS).toBe(THREE.RepeatWrapping)
    expect(texture.wrapT).toBe(THREE.RepeatWrapping)
    expect(texture.anisotropy).toBe(8)
  })
})
