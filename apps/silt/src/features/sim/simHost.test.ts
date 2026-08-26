import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY, GRID_WIDTH, MS_PER_TICK, SAND } from '../../sim/index.ts'
import { LocalSimHost, selectSimHostKind } from './simHost.ts'

describe('selectSimHostKind', () => {
  it('picks the worker only when the page is cross-origin isolated and has workers', () => {
    expect(selectSimHostKind({ crossOriginIsolated: true, hasWorker: true })).toBe('worker')
  })

  it('falls back to local without isolation, and without Worker', () => {
    expect(selectSimHostKind({ crossOriginIsolated: false, hasWorker: true })).toBe('local')
    expect(selectSimHostKind({ crossOriginIsolated: true, hasWorker: false })).toBe('local')
  })
})

describe('LocalSimHost', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies a paint synchronously and bumps the view revision', () => {
    const host = new LocalSimHost()
    const before = host.view.revision

    host.send({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 20], species: SAND })

    expect(host.view.speciesAt(20, 10)).toBe(SAND)
    expect(host.view.countSpecies(SAND)).toBe(1)
    expect(host.view.revision).toBeGreaterThan(before)
    host.dispose()
  })

  it('ticks on its own clock while running', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    let clock = 0
    const host = new LocalSimHost(() => clock)
    host.send({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })
    host.send({ type: 'setRunning', running: true })

    // The first interval fire only anchors the clock; the second sees two
    // ticks' worth of elapsed time and runs both.
    vi.advanceTimersByTime(MS_PER_TICK)
    clock = MS_PER_TICK * 2
    vi.advanceTimersByTime(MS_PER_TICK)

    expect(host.view.speciesAt(10, 10)).toBe(EMPTY)
    expect(host.view.speciesAt(10, 12)).toBe(SAND)
    host.dispose()
  })

  it('stops ticking once disposed', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    let clock = 0
    const host = new LocalSimHost(() => clock)
    host.send({ type: 'paintCells', cellIndices: [10 * GRID_WIDTH + 10], species: SAND })
    host.send({ type: 'setRunning', running: true })
    vi.advanceTimersByTime(MS_PER_TICK)
    host.dispose()

    clock = MS_PER_TICK * 10
    vi.advanceTimersByTime(MS_PER_TICK * 10)

    expect(host.view.speciesAt(10, 10)).toBe(SAND)
  })

  it('exposes the same element registry the sim renders from', () => {
    const host = new LocalSimHost()
    expect(host.registry.get(SAND)?.name).toBe('sand')
    host.dispose()
  })
})
