import { describe, expect, it } from 'vitest'

import { DIRT, EMPTY, Sim, WATER } from '../../sim/index.ts'
import { emitSpawners, isUnderBrush, type Spawner } from './spawners.ts'

describe('emitSpawners', () => {
  it('paints a spawner element into its empty cell', () => {
    const sim = new Sim()
    const spawners: Spawner[] = [{ x: 10, y: 10, element: WATER }]

    emitSpawners(sim, spawners)

    expect(sim.speciesAt(10, 10)).toBe(WATER)
  })

  it('does not overwrite whatever is already sitting on the spawner cell', () => {
    const sim = new Sim()
    sim.paint(10, 10, WATER)
    const spawners: Spawner[] = [{ x: 10, y: 10, element: DIRT }]

    emitSpawners(sim, spawners)

    expect(sim.speciesAt(10, 10)).toBe(WATER)
  })

  it('leaves the grid untouched when there are no spawners', () => {
    const sim = new Sim()

    emitSpawners(sim, [])

    expect(sim.speciesAt(5, 5)).toBe(EMPTY)
  })
})

describe('isUnderBrush', () => {
  const spawner: Spawner = { x: 40, y: 40 , element: WATER }

  it('covers the centre cell with a single-cell brush', () => {
    expect(isUnderBrush(spawner, { x: 40, y: 40 }, 1)).toBe(true)
  })

  it('leaves the neighbouring cell alone with a single-cell brush', () => {
    expect(isUnderBrush(spawner, { x: 41, y: 40 }, 1)).toBe(false)
  })

  it('reaches a cell away from centre once the brush is wide enough', () => {
    expect(isUnderBrush(spawner, { x: 42, y: 42 }, 5)).toBe(true)
    expect(isUnderBrush(spawner, { x: 42, y: 42 }, 3)).toBe(false)
  })

  it('covers the whole square, corners included', () => {
    expect(isUnderBrush(spawner, { x: 37, y: 43 }, 7)).toBe(true)
    expect(isUnderBrush(spawner, { x: 36, y: 43 }, 7)).toBe(false)
  })
})
