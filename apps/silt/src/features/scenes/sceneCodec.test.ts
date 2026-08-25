import { describe, expect, it } from 'vitest'

import {
  BYTES_PER_CELL,
  createRegistry,
  EMPTY,
  RA_OFFSET,
  RB_OFFSET,
  SAND,
  SPECIES_OFFSET,
  v1Elements,
  v1Reactions,
  WATER,
  type ElementDef,
} from '../../sim/index.ts'
import {
  decodeScene,
  encodeScene,
  SceneLoadError,
  type CellSource,
  type SceneEnvelope,
} from './sceneCodec.ts'

const v1 = createRegistry(v1Elements, v1Reactions)

/** A roster water has been taken out of. Steam goes with it — it condenses
 * back into water, and the registry refuses a `lifetime.becomes` it cannot
 * resolve. */
const withoutWater = createRegistry(
  v1Elements.filter((e) => e.name !== 'water' && e.name !== 'steam'),
)

/** A grid-shaped source the codec can read, with nothing but the bytes in it. */
function source(
  width: number,
  height: number,
): CellSource & {
  set(x: number, y: number, species: number, ra: number, rb: number): void
} {
  const cells = new Uint8Array(width * height * BYTES_PER_CELL)
  return {
    width,
    height,
    cells,
    set(x, y, species, ra, rb) {
      const i = (y * width + x) * BYTES_PER_CELL
      cells[i + SPECIES_OFFSET] = species
      cells[i + RA_OFFSET] = ra
      cells[i + RB_OFFSET] = rb
      // clock deliberately left non-zero: it must not survive the round trip.
      cells[i + BYTES_PER_CELL - 1] = 99
    },
  }
}

function speciesAt(planes: { species: Uint8Array }, width: number, x: number, y: number): number {
  return planes.species[y * width + x]!
}

describe('encodeScene / decodeScene', () => {
  it('round-trips cells pixel-identically, ra and rb included', () => {
    const world = source(8, 6)
    world.set(2, 3, SAND, 17, 200)
    world.set(7, 5, WATER, 0, 3)

    const envelope = encodeScene(world, [{ x: 1, y: 1, element: WATER }], v1)
    const scene = decodeScene(JSON.stringify(envelope), { width: 8, height: 6 }, v1)

    expect(scene.species[3 * 8 + 2]).toBe(SAND)
    expect(scene.ra[3 * 8 + 2]).toBe(17)
    expect(scene.rb[3 * 8 + 2]).toBe(200)
    expect(scene.species[5 * 8 + 7]).toBe(WATER)
    expect(scene.rb[5 * 8 + 7]).toBe(3)
    expect(scene.spawners).toEqual([{ x: 1, y: 1, element: WATER }])
    expect(scene.warnings).toEqual([])
  })

  it('remaps species by name, not by id, when the registry has renumbered', () => {
    const world = source(4, 4)
    world.set(0, 0, SAND, 0, 0)
    const envelope = encodeScene(world, [{ x: 1, y: 1, element: SAND }], v1)

    const renumbered = createRegistry([
      { ...(v1Elements.find((e) => e.name === 'sand') as ElementDef), id: 77 },
    ])
    const scene = decodeScene(JSON.stringify(envelope), { width: 4, height: 4 }, renumbered)

    expect(speciesAt(scene, 4, 0, 0)).toBe(77)
    expect(scene.spawners).toEqual([{ x: 1, y: 1, element: 77 }])
  })

  it('turns an unknown element name into an empty cell, warns, and still loads', () => {
    const world = source(4, 4)
    world.set(0, 0, SAND, 5, 5)
    world.set(1, 0, WATER, 0, 0)
    const envelope = encodeScene(world, [], v1)

    const scene = decodeScene(JSON.stringify(envelope), { width: 4, height: 4 }, withoutWater)

    expect(speciesAt(scene, 4, 0, 0)).toBe(SAND)
    expect(speciesAt(scene, 4, 1, 0)).toBe(EMPTY)
    expect(scene.ra[1]).toBe(0)
    expect(scene.warnings.join(' ')).toContain('water')
  })

  it('drops a spawner whose element is gone and tolerates unknown spawner fields', () => {
    const world = source(4, 4)
    const envelope = encodeScene(
      world,
      [
        { x: 1, y: 1, element: WATER },
        { x: 2, y: 2, element: SAND },
      ],
      v1,
    )
    const loose = {
      ...envelope,
      spawners: envelope.spawners.map((spawner) => ({ ...spawner, rate: 3 })),
    }

    const scene = decodeScene(JSON.stringify(loose), { width: 4, height: 4 }, withoutWater)

    expect(scene.spawners).toEqual([{ x: 2, y: 2, element: SAND }])
    expect(scene.warnings.join(' ')).toContain('water')
  })

  it('pastes a smaller scene anchored bottom-centre, spawners offset with it', () => {
    const world = source(4, 2)
    world.set(0, 0, SAND, 0, 0)
    const envelope = encodeScene(world, [{ x: 0, y: 0, element: SAND }], v1)

    // 10 wide → offsetX = (10 - 4) / 2 = 3; 6 tall → offsetY = 6 - 2 = 4.
    const scene = decodeScene(JSON.stringify(envelope), { width: 10, height: 6 }, v1)

    expect(scene.species).toHaveLength(60)
    expect(speciesAt(scene, 10, 3, 4)).toBe(SAND)
    expect(speciesAt(scene, 10, 0, 0)).toBe(EMPTY)
    expect(scene.spawners).toEqual([{ x: 3, y: 4, element: SAND }])
  })

  it('refuses a scene larger than the current world, naming both sizes', () => {
    const envelope = encodeScene(source(20, 20), [], v1)

    expect(() => decodeScene(JSON.stringify(envelope), { width: 10, height: 10 }, v1)).toThrow(
      /20×20.*10×10/,
    )
  })

  it('refuses unparseable JSON, an unknown version, and a short plane', () => {
    expect(() => decodeScene('{not json', { width: 4, height: 4 }, v1)).toThrow(SceneLoadError)

    const envelope = encodeScene(source(4, 4), [], v1)
    const future: SceneEnvelope = { ...envelope, version: 99 }
    expect(() => decodeScene(JSON.stringify(future), { width: 4, height: 4 }, v1)).toThrow(
      /version/,
    )

    const truncated: SceneEnvelope = { ...envelope, ra: btoa('short') }
    expect(() => decodeScene(JSON.stringify(truncated), { width: 4, height: 4 }, v1)).toThrow(
      SceneLoadError,
    )
  })
})
