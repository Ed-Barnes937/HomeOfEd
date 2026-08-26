import { describe, expect, it } from 'vitest'

import { DIRT, EMPTY, Sim, WATER } from '../../sim/index.ts'
import { brushOffsets } from '../sim/brushOffsets.ts'
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
    expect(isUnderBrush(spawner, { x: 42, y: 40 }, 5)).toBe(true)
    expect(isUnderBrush(spawner, { x: 42, y: 40 }, 3)).toBe(false)
  })

  it('is round: the square corners fall outside the brush', () => {
    expect(isUnderBrush(spawner, { x: 42, y: 42 }, 5)).toBe(false)
    expect(isUnderBrush(spawner, { x: 42, y: 42 }, 7)).toBe(true)
    expect(isUnderBrush(spawner, { x: 37, y: 43 }, 7)).toBe(false)
  })

  it('agrees with the paint footprint for every shipped width', () => {
    for (const width of [1, 3, 5, 7]) {
      const offsets = brushOffsets(width)
      const reach = Math.ceil(width / 2)
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const painted = offsets.some((o) => o.dx === dx && o.dy === dy)
          const swept = isUnderBrush(spawner, { x: spawner.x - dx, y: spawner.y - dy }, width)
          expect(swept).toBe(painted)
        }
      }
    }
  })
})
