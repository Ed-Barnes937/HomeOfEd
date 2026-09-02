import { describe, expect, it } from 'vitest'

import { EMPTY, MS_PER_TICK, SAND, SPECIES_OFFSET, BYTES_PER_CELL, GRID_WIDTH, WATER } from '../../sim/index.ts'
import { createSharedWorld, STATUS_REVISION, STATUS_WRITE_SEQ } from './simProtocol.ts'
import { SimWorkerCore } from './simWorkerCore.ts'

function speciesAt(world: ReturnType<typeof createSharedWorld>, x: number, y: number): number {
  const cells = new Uint8Array(world.cells)
  return cells[(y * GRID_WIDTH + x) * BYTES_PER_CELL + SPECIES_OFFSET]!
}

function revisionOf(world: ReturnType<typeof createSharedWorld>): number {
  return Atomics.load(new Int32Array(world.status), STATUS_REVISION)
}

describe('SimWorkerCore', () => {
  it('paints into the shared cells and publishes a new revision', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    const before = revisionOf(world)

    core.handle({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 20], species: SAND })

    expect(speciesAt(world, 20, 10)).toBe(SAND)
    expect(revisionOf(world)).toBeGreaterThan(before)
  })

  it('painting never replaces an occupied cell — a stroke through water leaves the water', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    const pond = 10 * GRID_WIDTH + 20
    core.handle({ type: 'paintCells', cellIndices: [pond], species: WATER })

    core.handle({ type: 'paintCells', cellIndices: [pond, pond + 1], species: SAND })

    expect(speciesAt(world, 20, 10)).toBe(WATER)
    expect(speciesAt(world, 21, 10)).toBe(SAND)
  })

  it('erasing still clears occupied cells', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    const basin = 10 * GRID_WIDTH + 20
    core.handle({ type: 'paintCells', cellIndices: [basin], species: WATER })

    core.handle({ type: 'paintCells', cellIndices: [basin], species: EMPTY })

    expect(speciesAt(world, 20, 10)).toBe(EMPTY)
  })

  it('ticks at the fixed rate while running — sand falls one cell per tick', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    core.handle({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })
    core.handle({ type: 'setRunning', running: true })

    core.advance(0)
    core.advance(MS_PER_TICK)

    expect(speciesAt(world, 10, 10)).toBe(EMPTY)
    expect(speciesAt(world, 10, 11)).toBe(SAND)
  })

  it('does not tick while paused', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    core.handle({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })

    core.advance(0)
    core.advance(MS_PER_TICK * 10)

    expect(speciesAt(world, 10, 10)).toBe(SAND)
  })

  it('does not tick while hidden, and does not repay the hidden time on return', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    core.handle({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })
    core.handle({ type: 'setRunning', running: true })
    core.handle({ type: 'setVisible', visible: false })

    core.advance(0)
    core.advance(MS_PER_TICK * 100)
    expect(speciesAt(world, 10, 10)).toBe(SAND)

    // Coming back runs from now, not from the debt built up while hidden.
    core.handle({ type: 'setVisible', visible: true })
    core.advance(MS_PER_TICK * 101)
    expect(speciesAt(world, 10, 11)).toBe(SAND)
    expect(speciesAt(world, 10, 12)).toBe(EMPTY)
  })

  it('emits spawners before each tick — spec §7 order', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    core.handle({ type: 'setSpawners', spawners: [{ x: 30, y: 5, element: WATER }] })
    core.handle({ type: 'setRunning', running: true })

    core.advance(0)
    core.advance(MS_PER_TICK)

    // One emission happened, and the tick then moved the drop down.
    expect(speciesAt(world, 30, 6)).toBe(WATER)
  })

  it('step advances exactly one tick while paused, emission included', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    core.handle({ type: 'setSpawners', spawners: [{ x: 30, y: 5, element: WATER }] })

    core.handle({ type: 'step' })

    expect(speciesAt(world, 30, 6)).toBe(WATER)
  })

  it('reset clears the shared world', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    core.handle({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })

    core.handle({ type: 'reset' })

    expect(speciesAt(world, 10, 10)).toBe(EMPTY)
  })

  it('leaves the write sequence even (no write in progress) after every operation', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    const seq = () => Atomics.load(new Int32Array(world.status), STATUS_WRITE_SEQ)

    expect(seq() % 2).toBe(0)
    core.handle({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })
    expect(seq() % 2).toBe(0)
    core.handle({ type: 'setRunning', running: true })
    core.advance(0)
    core.advance(MS_PER_TICK * 3)
    expect(seq() % 2).toBe(0)
    // …and ticking moved it on: a reader that overlapped those writes can tell.
    expect(seq()).toBeGreaterThan(0)
  })

  it('restore replaces the world with the given planes', () => {
    const world = createSharedWorld()
    const core = new SimWorkerCore(world)
    const size = new Uint8Array(world.cells).length / BYTES_PER_CELL
    const species = new Uint8Array(size)
    species[7 * GRID_WIDTH + 3] = SAND

    core.handle({ type: 'restore', species, ra: new Uint8Array(size), rb: new Uint8Array(size) })

    expect(speciesAt(world, 3, 7)).toBe(SAND)
  })
})
