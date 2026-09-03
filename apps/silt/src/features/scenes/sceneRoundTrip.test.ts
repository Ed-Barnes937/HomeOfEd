import { expect, it } from 'vitest'

import {
  BYTES_PER_CELL,
  CLOCK_OFFSET,
  RA_OFFSET,
  SAND,
  Sim,
  SPECIES_OFFSET,
  v1Elements,
  v1Reactions,
  WATER,
  type ElementDef,
} from '../../sim/index.ts'
import { decodeScene, encodeScene } from './sceneCodec.ts'

/** An element with a lifetime, so `ra` carries a real countdown to round-trip.
 * Test-only, and named so it stays out of the roster's namespace - the registry
 * refuses a duplicate name, and this fixture used to be called `ember`, which
 * the burnables effort then took for a real species. */
const decay: ElementDef = {
  id: 20,
  name: 'decay',
  colours: ['#ff5522'],
  tags: ['powder'],
  archetype: { kind: 'powder', density: 5, slide: 0.5 },
  lifetime: { ticks: 200, becomes: null },
}

const roster = [...v1Elements, decay]

function planeOf(sim: Sim, offset: number): number[] {
  const values: number[] = []
  for (let i = offset; i < sim.cells.length; i += BYTES_PER_CELL) values.push(sim.cells[i]!)
  return values
}

it('a painted, simmed world survives encode → decode → restore pixel-identically', () => {
  const sim = new Sim({ elements: roster, reactions: v1Reactions })
  for (let x = 140; x < 160; x++) {
    sim.paint(x, 40, SAND)
    sim.paint(x, 42, WATER)
    sim.paint(x, 44, decay.id)
  }
  for (let i = 0; i < 30; i++) sim.tick()

  // Thirty ticks in, the world carries real clock stamps — so the assertion
  // further down that the load zeroed them cannot pass vacuously.
  expect(planeOf(sim, CLOCK_OFFSET).some((value) => value > 0)).toBe(true)

  const spawners = [{ x: 10, y: 10, element: WATER }]
  const envelope = encodeScene(sim, spawners, sim.registry)

  const loaded = new Sim({ elements: roster, reactions: v1Reactions })
  const scene = decodeScene(
    JSON.stringify(envelope),
    { width: loaded.width, height: loaded.height },
    loaded.registry,
  )
  loaded.restore(scene.species, scene.ra, scene.rb)

  expect(planeOf(loaded, SPECIES_OFFSET)).toEqual(planeOf(sim, SPECIES_OFFSET))
  // Those cells were mid-countdown, so this is only equal if `ra` persisted.
  expect(planeOf(sim, RA_OFFSET).some((value) => value > 0)).toBe(true)
  expect(planeOf(loaded, RA_OFFSET)).toEqual(planeOf(sim, RA_OFFSET))
  expect(scene.spawners).toEqual(spawners)

  // `clock` is runtime bookkeeping, not scene data (spec §8): the envelope has
  // no plane for it and the load lands on a freshly cleared generation 0. A
  // fourth plane added later must not quietly start carrying it.
  expect(JSON.stringify(envelope)).not.toContain('clock')
  expect(planeOf(loaded, CLOCK_OFFSET).every((value) => value === 0)).toBe(true)

  // A restored world is a live one, not a picture of one — restore has to wake
  // the chunks it filled or the first tick would scan nothing.
  loaded.tick()
  expect(loaded.scannedLastTick).toBeGreaterThan(0)
})
