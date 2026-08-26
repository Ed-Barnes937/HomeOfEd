// The worker's whole brain, DOM-free and timer-free so vitest can drive it
// headless: the entry file (`simWorker.ts`) only binds `handle` to onmessage
// and `advance` to an interval. Owns the Sim (constructed over the shared
// cells), the fixed-timestep clock, and the spawner list — emission runs
// inside the tick loop, before each tick, exactly as the main-thread loop did
// (spec §7).
import { FixedTimestep, MS_PER_TICK, Sim } from '../../sim/index.ts'
import { emitSpawners, type Spawner } from '../spawners/spawners.ts'
import { STATUS_REVISION, type SimWorkerMessage, type WorldBuffers } from './simProtocol.ts'

export class SimWorkerCore {
  readonly #sim: Sim
  readonly #status: Int32Array
  readonly #timestep = new FixedTimestep(MS_PER_TICK)
  #spawners: readonly Spawner[] = []
  #running = false
  #visible = true
  #lastNow: number | null = null

  constructor(world: WorldBuffers, seed?: number) {
    this.#sim = new Sim({ seed, buffer: world.cells })
    this.#status = new Int32Array(world.status)
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
        for (const index of message.cellIndices) {
          sim.paint(index % sim.width, (index / sim.width) | 0, message.species)
        }
        break
      case 'setSpawners':
        this.#spawners = message.spawners
        break
      case 'step':
        this.#tick()
        break
      case 'reset':
        sim.clear()
        break
      case 'restore':
        sim.restore(message.species, message.ra, message.rb)
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
    this.#timestep.advance(nowMs - last, () => this.#tick())
    this.#publish()
  }

  #tick(): void {
    emitSpawners(this.#sim, this.#spawners)
    this.#sim.tick()
  }

  /** The revision is what the render thread polls per frame — see `simProtocol.ts`. */
  #publish(): void {
    Atomics.store(this.#status, STATUS_REVISION, this.#sim.revision | 0)
  }
}
