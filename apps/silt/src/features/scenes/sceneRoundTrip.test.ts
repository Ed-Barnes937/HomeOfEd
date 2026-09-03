import { expect, it } from 'vitest'

import {
  BURIED,
  BYTES_PER_CELL,
  CLOCK_OFFSET,
  FLOWER,
  MUD,
  RA_OFFSET,
  SAND,
  Sim,
  SPECIES_OFFSET,
  SPROUT,
  STALK,
  STONE,
  TIP,
  v1Elements,
  v1Reactions,
  WATER,
  type ElementDef,
} from '../../sim/index.ts'
import { decodeScene, encodeScene } from './sceneCodec.ts'

/** An element with a lifetime, so `ra` carries a real countdown to round-trip.
 * Test-only, and named *and numbered* to stay out of the roster's way - the
 * registry refuses a duplicate of either. This fixture used to be called
 * `ember`, which the burnables effort then took for a real species, and used to
 * sit on id 20, which the life effort then took for the buried seed. 250 is far
 * enough above the roster that it will not be walked into a third time. */
const decay: ElementDef = {
  id: 250,
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

/**
 * **Building a meadow scene** (life ticket 06), and the two rules a scene has to
 * know that nothing else enforces.
 *
 * *A pond must be stone-lined and stone-floored.* An earth basin does not hold
 * water: `water + dirt -> mud`, and mud is a *liquid*, so the walls wet through
 * and the pond oozes away with them. Stone has no such row.
 *
 * *A pre-grown meadow is pre-aged, or it dies as one cohort.* Scene building is
 * what `paint`'s `ra` seed exists for (life ticket 01) - but only the growers
 * can take it, because on everything else `ra` is the engine's countdown and the
 * call throws (`requireRaIsFree`). So a scene ages a meadow by giving each stalk
 * *tip* a different travelling budget: they climb different heights, bloom on
 * different ticks and wither on different ticks, all from one placement. The
 * flowers' own spread comes from `lifetime.jitter` instead, which is drawn on
 * their first tick.
 */
const FLOOR_MARGIN = 1

/** A stone-lined, stone-floored basin holding `depth` cells of water. */
function stoneBasin(sim: Sim, left: number, right: number, depth: number): void {
  const floor = sim.height - FLOOR_MARGIN
  for (let x = left - 1; x <= right + 1; x++) sim.paint(x, floor, STONE)
  for (let i = 1; i <= depth + 1; i++) {
    sim.paint(left - 1, floor - i, STONE)
    sim.paint(right + 1, floor - i, STONE)
  }
  for (let x = left; x <= right; x++) {
    for (let i = 1; i <= depth; i++) sim.paint(x, floor - i, WATER)
  }
}

/**
 * A plant already part-grown: `grown` cells of stem with a tip on top carrying
 * `budget` more. `budget` counts height + 1, so 1 is spent and blooms at once.
 */
function plantAt(sim: Sim, x: number, grown: number, budget: number): void {
  const floor = sim.height - FLOOR_MARGIN
  for (let i = 1; i <= grown; i++) sim.paint(x, floor - i, STALK)
  sim.paint(x, floor - grown - 1, TIP, { ra: budget })
}

it('a built meadow keeps its bed, its stone pond and its pre-aged plants across a save', () => {
  const sim = new Sim({ seed: 1 })
  const floor = sim.height - FLOOR_MARGIN
  for (let x = 20; x <= 120; x++) sim.paint(x, floor, STONE)
  for (let x = 20; x <= 120; x++) sim.paint(x, floor - 1, MUD)
  for (const x of [30, 55, 80, 105]) sim.paint(x, floor - 1, BURIED)
  stoneBasin(sim, 140, 170, 6)
  // Three ages of plant, and one seedling that has not risen yet.
  const ages: [number, number][] = [
    [40, 2],
    [65, 5],
    [90, 8],
  ]
  for (const [x, grown] of ages) plantAt(sim, x, grown, 10 - grown)
  sim.paint(115, floor - 1, SPROUT)

  const envelope = encodeScene(sim, [], sim.registry)
  const loaded = new Sim({ seed: 1 })
  const scene = decodeScene(
    JSON.stringify(envelope),
    { width: loaded.width, height: loaded.height },
    loaded.registry,
  )
  loaded.restore(scene.species, scene.ra, scene.rb)

  // The travelling budgets came back, which is the whole of "pre-aged": without
  // them every restored tip would read as unseeded and bloom where it stands.
  expect(planeOf(loaded, SPECIES_OFFSET)).toEqual(planeOf(sim, SPECIES_OFFSET))
  expect(planeOf(loaded, RA_OFFSET)).toEqual(planeOf(sim, RA_OFFSET))
  for (const [x, grown] of ages) {
    expect(loaded.speciesAt(x, floor - grown - 1)).toBe(TIP)
  }

  // Run the restored world on and watch the three bloom apart. The tallest has
  // eight cells left to climb at p 0.3, the shortest two, so they arrive in
  // order and not together - which is the cohort problem the pre-ageing solves.
  const bloomed: number[] = []
  const seen = new Set<number>()
  for (let t = 0; t < 400; t++) {
    loaded.tick()
    for (const [x] of ages) {
      if (seen.has(x)) continue
      for (let y = floor - 12; y < floor; y++) {
        if (loaded.speciesAt(x, y) === FLOWER) {
          seen.add(x)
          bloomed.push(t)
          break
        }
      }
    }
  }
  expect(bloomed).toHaveLength(3)
  expect(new Set(bloomed).size).toBe(3)

  // And the pond is exactly where it was put: stone holds water, earth would
  // have wet through and taken the basin with it.
  const water = (): number => {
    let total = 0
    for (let x = 139; x <= 171; x++) {
      for (let y = floor - 8; y <= floor; y++) if (loaded.speciesAt(x, y) === WATER) total++
    }
    return total
  }
  const held = water()
  // 140..170 inclusive is 31 columns, six deep.
  expect(held).toBe(31 * 6)
  for (let t = 0; t < 600; t++) loaded.tick()
  expect(water()).toBe(held)
})
