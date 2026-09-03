// The worker's whole brain, DOM-free and timer-free so vitest can drive it
// headless: the entry file (`simWorker.ts`) only binds `handle` to onmessage
// and `advance` to an interval. Owns the Sim (constructed over the shared
// cells), the fixed-timestep clock, and the spawner list — emission runs
// inside the tick loop, before each tick, exactly as the main-thread loop did
// (spec §7).
import { EMPTY, FixedTimestep, MS_PER_TICK, Sim } from '../../sim/index.ts'
import { witnessedKey, type EdgeKey } from '../fieldNotes/edgeKeys.ts'
import { emitSpawners, type Spawner } from '../spawners/spawners.ts'
import {
  STATUS_REVISION,
  STATUS_WRITE_SEQ,
  type SimPageMessage,
  type SimWorkerMessage,
  type WorldBuffers,
} from './simProtocol.ts'

export interface SimWorkerCoreOptions {
  /** Per-session determinism, as `SimOptions.seed`. */
  seed?: number
  /**
   * How the sim speaks to the page: `postMessage` in the worker, a direct
   * dispatch in the local host. Absent in tests that do not care.
   */
  report?: (message: SimPageMessage) => void
}

export class SimWorkerCore {
  readonly #sim: Sim
  readonly #status: Int32Array
  readonly #timestep = new FixedTimestep(MS_PER_TICK)
  readonly #report: ((message: SimPageMessage) => void) | undefined
  /**
   * Edge keys the page has already been told about - seeded at boot with what
   * it has persisted, then grown as firsts are reported. The sim's own witness
   * table is the hot-path guard; this is the far cheaper question of whether
   * the *page* would learn anything from the message (discovery-tree spec §4).
   */
  readonly #reported = new Set<EdgeKey>()
  #spawners: readonly Spawner[] = []
  #running = false
  #visible = true
  #lastNow: number | null = null

  constructor(world: WorldBuffers, options: SimWorkerCoreOptions = {}) {
    this.#sim = new Sim({ seed: options.seed, buffer: world.cells })
    this.#status = new Int32Array(world.status)
    this.#report = options.report
    this.#publish()
  }

  handle(message: SimWorkerMessage): void {
    const sim = this.#sim
    switch (message.type) {
      case 'setRunning':
        this.#running = message.running
        break
      case 'setVisible':
        this.#visible = message.visible
        break
      case 'paintCells':
        // Applied on receipt, not deferred to the next tick — between ticks is
        // exactly when a main-thread paint landed, and the next rAF sees it.
        // The brush fills, it never converts: an occupied cell is skipped (the
        // same stance emitSpawners takes), so a stroke through a stone basin
        // or a pond adds material around it instead of cutting through it.
        // Erasing (EMPTY) is exempt — clearing occupied cells is its job.
        this.#mutate(() => {
          for (const index of message.cellIndices) {
            const x = index % sim.width
            const y = (index / sim.width) | 0
            if (message.species !== EMPTY && sim.speciesAt(x, y) !== EMPTY) continue
            sim.paint(x, y, message.species)
          }
        })
        break
      case 'setSpawners':
        this.#spawners = message.spawners
        break
      case 'step':
        this.#mutate(() => this.#tick())
        break
      case 'reset':
        this.#mutate(() => sim.clear())
        break
      case 'restore':
        this.#mutate(() => sim.restore(message.species, message.ra, message.rb))
        break
      case 'seedWitnessed':
        for (const key of message.keys) this.#reported.add(key)
        break
    }
    this.#publish()
  }

  /**
   * Run whole ticks for the time since the last call. Gated on running AND
   * visible; while gated the clock's debt is dropped (`reset`), so coming
   * back never replays the time away — the same stance the main-thread loop
   * took on a backgrounded tab.
   */
  advance(nowMs: number): void {
    const last = this.#lastNow ?? nowMs
    this.#lastNow = nowMs
    if (!this.#running || !this.#visible) {
      this.#timestep.reset()
      return
    }
    this.#timestep.advance(nowMs - last, () => this.#mutate(() => this.#tick()))
    this.#publish()
  }

  #tick(): void {
    emitSpawners(this.#sim, this.#spawners)
    this.#sim.tick()
    this.#reportWitnessed()
  }

  /**
   * The one thing the sim says back to the page. A tick that witnessed nothing
   * new - which is all but a few dozen ticks in a session - costs an empty
   * array and a length check, so this stays off the frame budget without any
   * throttling of its own.
   */
  #reportWitnessed(): void {
    const events = this.#sim.drainWitnessed()
    if (events.length === 0) return

    const keys: EdgeKey[] = []
    for (const event of events) {
      const key = witnessedKey(event)
      if (this.#reported.has(key)) continue
      this.#reported.add(key)
      keys.push(key)
    }
    if (keys.length > 0) this.#report?.({ type: 'witnessed', keys })
  }

  /**
   * Bracket every cell-byte mutation with the write seqlock — odd while a
   * write is in flight, even and advanced once it is done — so a cross-thread
   * reader can tell whether its read overlapped one (see `STATUS_WRITE_SEQ`).
   */
  #mutate(write: () => void): void {
    Atomics.add(this.#status, STATUS_WRITE_SEQ, 1)
    try {
      write()
    } finally {
      Atomics.add(this.#status, STATUS_WRITE_SEQ, 1)
    }
  }

  /** The revision is what the render thread polls per frame — see `simProtocol.ts`. */
  #publish(): void {
    Atomics.store(this.#status, STATUS_REVISION, this.#sim.revision | 0)
  }
}
