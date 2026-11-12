import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Every piece of the smithy's art ends as an encoded SVG data URL, so counting encodes counts builds.
it("loading the smithy's modules builds none of its art; its first scene builds it once", async () => {
  vi.stubGlobal('Image', class {})
  vi.resetModules()
  const encode = vi.spyOn(globalThis, 'encodeURIComponent')
  await import('./smithy.ts')
  expect(encode).not.toHaveBeenCalled()

  const { anvilImage } = await import('./anvilArt.ts')
  const { forgeImages } = await import('./ForgeWall.tsx')
  const { smithyCardArt } = await import('../share/smithyCard.ts')
  expect(forgeImages()).toBe(forgeImages())
  expect(anvilImage()).toBe(anvilImage())
  expect(smithyCardArt()).toBe(smithyCardArt())
  expect(encode).toHaveBeenCalledTimes(6)
})
