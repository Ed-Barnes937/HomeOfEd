import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { PICTURE_GROUND } from '../potion/framing.ts'
import { captureOverGround } from './PotionStage.tsx'

/** A renderer that keeps its clear colour and records what it was when the scene was drawn. */
function stubState(opts: { throws?: boolean } = {}) {
  const clear = { colour: new THREE.Color('#123456'), alpha: 0 }
  const drawnOver: { colour: string; alpha: number }[] = []
  const gl = {
    domElement: { width: 2000, height: 2000 },
    getClearColor: (out: THREE.Color) => out.copy(clear.colour),
    getClearAlpha: () => clear.alpha,
    setClearColor: (colour: THREE.ColorRepresentation, alpha: number) => {
      clear.colour = new THREE.Color(colour)
      clear.alpha = alpha
    },
    getPixelRatio: () => 2,
    setPixelRatio: () => {},
    setSize: () => {},
    render: () => {
      drawnOver.push({ colour: clear.colour.getHexString(), alpha: clear.alpha })
      if (opts.throws) throw new Error('lost context')
    },
  }
  const state = {
    gl,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    size: { width: 400, height: 400 },
  } as unknown as RootState
  return { state, clear, drawnOver }
}

describe("the potion's picture", () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test("is drawn over the card's own ground, opaque, and leaves the canvas clear as it was", () => {
    const { state, clear, drawnOver } = stubState()
    const picture = captureOverGround(state, PICTURE_GROUND)
    expect(drawnOver).toEqual([
      { colour: new THREE.Color(PICTURE_GROUND).getHexString(), alpha: 1 },
    ])
    expect(picture.width).toBe(2000)
    expect(clear.colour.getHexString()).toBe('123456')
    expect(clear.alpha).toBe(0)
  })

  test('puts the clear colour back even when the draw fails', () => {
    const { state, clear, drawnOver } = stubState({ throws: true })
    expect(() => captureOverGround(state, PICTURE_GROUND)).toThrow('lost context')
    expect(drawnOver[0]!.alpha).toBe(1)
    expect(clear.colour.getHexString()).toBe('123456')
    expect(clear.alpha).toBe(0)
  })
})
