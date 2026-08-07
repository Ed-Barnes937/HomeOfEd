import { describe, expect, it } from 'vitest'

import { DIRT, EMPTY, Sim, WATER } from '../../sim/index.ts'
import { emitSpawners, type Spawner } from './spawners.ts'

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
