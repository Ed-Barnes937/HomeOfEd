import { describe, expect, it } from 'vitest'

import {
  BYTES_PER_CELL,
  createRegistry,
  SAND,
  SPECIES_OFFSET,
  v1Elements,
  v1Reactions,
} from '../../sim/index.ts'
import { decodeScene, encodeScene } from './sceneCodec.ts'
import { packScene, packThumbnail, thumbnailUrl, unpackScene } from './storedScene.ts'

const registry = createRegistry(v1Elements, v1Reactions)

function sceneJson(): string {
  const cells = new Uint8Array(300 * 200 * BYTES_PER_CELL)
  cells[(100 * 300 + 150) * BYTES_PER_CELL + SPECIES_OFFSET] = SAND
  const envelope = encodeScene({ width: 300, height: 200, cells }, [], registry, {
    edges: ['decay:fire'],
    reviewed: 1,
  })
  return JSON.stringify(envelope)
}

describe('packScene', () => {
  it('stores the three planes as bytes, a quarter smaller than their base64', () => {
    const json = sceneJson()

    const body = packScene(json)

    expect(body.kind).toBe('planes')
    if (body.kind !== 'planes') return
    expect(body.planes.species.byteLength).toBe(60_000)
    expect(body.planes.ra.byteLength).toBe(60_000)
    expect(body.planes.rb.byteLength).toBe(60_000)
    expect(JSON.stringify(body.envelope).length).toBeLessThan(2_000)
  })

  it('unpacks to a scene that decodes exactly as the original', () => {
    const json = sceneJson()

    const unpacked = unpackScene(packScene(json))

    expect(JSON.parse(unpacked)).toEqual(JSON.parse(json))
    const before = decodeScene(json, { width: 300, height: 200 }, registry)
    const after = decodeScene(unpacked, { width: 300, height: 200 }, registry)
    expect(after.species).toEqual(before.species)
    expect(after.fieldNotes).toEqual(before.fieldNotes)
  })

  it.each([
    ['not JSON', 'not a scene'],
    ['no planes', '{"version":1}'],
    ['a plane that is not base64', '{"species":"!!","ra":"","rb":""}'],
  ])('keeps %s as the text it was, so a broken scene stays broken rather than lost', (_, json) => {
    const body = packScene(json)

    expect(body).toEqual({ kind: 'json', json })
    expect(unpackScene(body)).toBe(json)
  })
})

describe('thumbnails', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='

  it('stores a PNG data URL as its bytes and gives the same URL back', () => {
    const bytes = packThumbnail(png)

    expect(bytes).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    expect(thumbnailUrl(bytes!)).toBe(png)
  })

  it('drops anything that is not a PNG data URL: it is decoration', () => {
    expect(packThumbnail('data:image/jpeg;base64,AAAA')).toBeNull()
    expect(packThumbnail('data:image/png;base64,!!')).toBeNull()
  })
})
