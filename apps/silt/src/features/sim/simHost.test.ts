import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMPTY, GRID_HEIGHT, GRID_WIDTH, LAVA, MS_PER_TICK, SAND, WATER } from '../../sim/index.ts'
import { createLocalWorld, STATUS_WRITE_SEQ, type SimPageMessage } from './simProtocol.ts'
import { LocalSimHost, selectSimHostKind, WorkerSimHost, WorldView, type SimHost } from './simHost.ts'

/**
 * Water and lava wedged side by side on the floor - the `p: 1` row fires on the
 * first tick, so one step is one first witness. Same fixture as the core's.
 */
function wetLava(host: SimHost): void {
  const floor = (GRID_HEIGHT - 1) * GRID_WIDTH
  host.send({ type: 'paintCells', cellIndices: [floor + 40], species: WATER })
  host.send({ type: 'paintCells', cellIndices: [floor + 41], species: LAVA })
}

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

  it('calls back on a first witness, once per key', () => {
    const host = new LocalSimHost()
    const seen: string[][] = []
    host.onWitnessed((keys) => seen.push([...keys]))
    wetLava(host)

    for (let i = 0; i < 4; i++) host.send({ type: 'step' })

    expect(seen).toEqual([['react:lava+water']])
    host.dispose()
  })

  it('stops calling back once unsubscribed, and never reports a seeded key', () => {
    const host = new LocalSimHost()
    const seen: string[][] = []
    const unsubscribe = host.onWitnessed((keys) => seen.push([...keys]))
    unsubscribe()
    host.send({ type: 'seedWitnessed', keys: ['decay:fire'] })
    wetLava(host)

    host.send({ type: 'step' })

    expect(seen).toEqual([])
    host.dispose()
  })
})

/**
 * A stand-in for the real `Worker`, injected the way `LocalSimHost` takes its
 * clock: the host's whole job in worker mode is relaying, so what is worth
 * pinning is that intent goes out and witnesses come back - not that a worker
 * thread exists, which vitest has no way to run.
 */
class FakeWorker {
  onmessage: ((event: MessageEvent<SimPageMessage>) => void) | null = null
  readonly posted: unknown[] = []
  terminated = false

  postMessage(message: unknown): void {
    this.posted.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  /** What the worker thread would post back. */
  emit(message: SimPageMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<SimPageMessage>)
  }
}

describe('WorkerSimHost', () => {
  const hostOver = (worker: FakeWorker) =>
    new WorkerSimHost(() => worker as unknown as Worker)

  it('hands the worker its buffers, then relays intent to it', () => {
    const worker = new FakeWorker()
    const host = hostOver(worker)

    host.send({ type: 'setRunning', running: true })

    expect(worker.posted[0]).toMatchObject({ type: 'init' })
    expect(worker.posted[1]).toEqual({ type: 'setRunning', running: true })
    host.dispose()
    expect(worker.terminated).toBe(true)
  })

  it('delivers a first witness posted back by the worker to its subscribers', () => {
    const worker = new FakeWorker()
    const host = hostOver(worker)
    const seen: string[][] = []
    const unsubscribe = host.onWitnessed((keys) => seen.push([...keys]))

    worker.emit({ type: 'witnessed', keys: ['react:lava+water'] })
    unsubscribe()
    worker.emit({ type: 'witnessed', keys: ['decay:fire'] })

    expect(seen).toEqual([['react:lava+water']])
    host.dispose()
  })
})

describe('WorldView.readConsistent', () => {
  it('returns the read straight away when no write is in progress', () => {
    const world = createLocalWorld()
    const view = new WorldView(world)

    let reads = 0
    const result = view.readConsistent(() => {
      reads++
      return 'snapshot'
    })

    expect(result).toBe('snapshot')
    expect(reads).toBe(1)
  })

  it('retries a read that overlapped a write, and returns the settled one', () => {
    const world = createLocalWorld()
    const view = new WorldView(world)
    const status = new Int32Array(world.status)
    // A write is in flight (odd sequence) for the first two read attempts,
    // then the writer finishes (even again).
    Atomics.store(status, STATUS_WRITE_SEQ, 1)

    let reads = 0
    const result = view.readConsistent(() => {
      reads++
      if (reads === 2) Atomics.store(status, STATUS_WRITE_SEQ, 2)
      return reads
    })

    expect(result).toBeGreaterThan(1)
    expect(Atomics.load(status, STATUS_WRITE_SEQ) % 2).toBe(0)
  })
})
