// Which thread runs the sim (120fps ticket 02): a dedicated worker when the
// page is cross-origin isolated (so a heavy world degrades the simulation
// rate, never the frame rate), the main thread otherwise — a live fallback,
// not dead code, mirroring the WebGL/Canvas-2D split from ticket 01. Both
// hosts run the same `SimWorkerCore` and speak the same `SimWorkerMessage`
// protocol; the page reads the world through the same `WorldView` either way.
import {
  BYTES_PER_CELL,
  createRegistry,
  GRID_HEIGHT,
  GRID_WIDTH,
  MS_PER_TICK,
  SPECIES_OFFSET,
  v1Elements,
  v1Reactions,
  WALL,
  type ElementRegistry,
} from '../../sim/index.ts'
import type { EdgeKey } from '../fieldNotes/edgeKeys.ts'
import type { RenderableSim } from '../render/renderer.ts'
import {
  createLocalWorld,
  createSharedWorld,
  STATUS_REVISION,
  STATUS_WRITE_SEQ,
  type SimPageMessage,
  type SimWorkerInit,
  type SimWorkerMessage,
  type WorldBuffers,
} from './simProtocol.ts'
import { SimWorkerCore } from './simWorkerCore.ts'

/** Told about interactions the player has just witnessed for the first time. */
export type WitnessListener = (keys: readonly EdgeKey[]) => void

/**
 * The page's subscription to what the sim reports back (discovery-tree spec
 * §4). One tiny channel both hosts hold, so a worker `postMessage` and a local
 * dispatch arrive at the page identically - the seam is the point.
 */
class WitnessChannel {
  readonly #listeners = new Set<WitnessListener>()

  subscribe(listener: WitnessListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /**
   * Discriminated on `type` even though `SimPageMessage` has one member today:
   * a second one would otherwise arrive here as a witness with no keys, and the
   * page would never say so.
   */
  deliver(message: SimPageMessage): void {
    if (message.type !== 'witnessed') return
    for (const listener of this.#listeners) listener(message.keys)
  }
}

/**
 * The page's read side of a world: the live cell bytes (shared memory in
 * worker mode, so reads are synchronous either way) plus the published
 * revision. Implements the renderer's `RenderableSim` seam and carries the
 * reads the test seam needs.
 */
export class WorldView implements RenderableSim {
  readonly width = GRID_WIDTH
  readonly height = GRID_HEIGHT
  readonly cells: Uint8Array
  readonly #status: Int32Array

  constructor(world: WorldBuffers) {
    this.cells = new Uint8Array(world.cells)
    this.#status = new Int32Array(world.status)
  }

  get revision(): number {
    return Atomics.load(this.#status, STATUS_REVISION)
  }

  /** Mirrors `Sim.speciesAt`: out of bounds reads the WALL sentinel. */
  speciesAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return WALL
    return this.cells[(y * this.width + x) * BYTES_PER_CELL + SPECIES_OFFSET]!
  }

  /** How many cells currently hold this species — the test seam's read. */
  countSpecies(species: number): number {
    let count = 0
    const cells = this.cells
    for (let i = SPECIES_OFFSET; i < cells.length; i += BYTES_PER_CELL) {
      if (cells[i] === species) count++
    }
    return count
  }

  /**
   * Run `read` so it cannot have overlapped a sim-side write: the write
   * seqlock (`STATUS_WRITE_SEQ`) must be even and unchanged across the read,
   * or the read retries. For reads whose result outlives the frame —
   * `saveScene` encodes the world for storage, where a mid-tick tear would be
   * permanent. The renderer deliberately does not use this (ADR 0036 accepts
   * on-screen tearing); a tick is ~1–2 ms, so a retry is rare and cheap.
   * Bounded: after `maxAttempts` the last read is returned rather than
   * hanging the page on a wedged writer.
   */
  readConsistent<T>(read: () => T, maxAttempts = 100): T {
    let result!: T
    for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt++) {
      const before = Atomics.load(this.#status, STATUS_WRITE_SEQ)
      result = read()
      const after = Atomics.load(this.#status, STATUS_WRITE_SEQ)
      if (before === after && before % 2 === 0) return result
    }
    return result
  }
}

/**
 * The surface `useSimLoop` drives. All intent goes through `send` — the one
 * funnel both hosts share with the wire protocol — and all state comes back
 * through `view`, so worker mode adds no second API to keep in step.
 */
export interface SimHost {
  /** Which thread ticks — surfaced through the test seam. */
  readonly kind: 'local' | 'worker'
  /**
   * The element registry the running sim draws from. Both hosts build it from
   * the same v1 tables the sim itself defaults to — in worker mode the sim's
   * own instance is unreachable, so this mirror is the one the rail and the
   * palette read.
   */
  readonly registry: ElementRegistry
  readonly view: WorldView
  send(message: SimWorkerMessage): void
  /**
   * Subscribe to first witnesses - the discovery metagame's one read that does
   * not come through `view`, because it is an event rather than a state the
   * render loop could poll (discovery-tree spec §4). Returns its unsubscribe.
   * Keys already seeded through `seedWitnessed` never arrive here.
   */
  onWitnessed(listener: WitnessListener): () => void
  dispose(): void
}

/** The same core the worker runs, on the main thread, ticking on an interval. */
export class LocalSimHost implements SimHost {
  readonly kind = 'local' as const
  readonly registry: ElementRegistry = createRegistry(v1Elements, v1Reactions)
  readonly view: WorldView
  readonly #core: SimWorkerCore
  readonly #interval: ReturnType<typeof setInterval>
  readonly #witnesses = new WitnessChannel()

  /** `now` is injectable so tests can drive the clock deterministically. */
  constructor(now: () => number = () => performance.now()) {
    const world = createLocalWorld()
    this.view = new WorldView(world)
    // No wire to cross, so the core's report lands on the subscribers directly
    // - the same call the worker path makes after a `postMessage` hop.
    this.#core = new SimWorkerCore(world, {
      report: (message) => this.#witnesses.deliver(message),
    })
    this.#interval = setInterval(() => this.#core.advance(now()), MS_PER_TICK)
  }

  send(message: SimWorkerMessage): void {
    this.#core.handle(message)
  }

  onWitnessed(listener: WitnessListener): () => void {
    return this.#witnesses.subscribe(listener)
  }

  dispose(): void {
    clearInterval(this.#interval)
  }
}

/** The core in a dedicated worker, over shared memory. */
export class WorkerSimHost implements SimHost {
  readonly kind = 'worker' as const
  readonly registry: ElementRegistry = createRegistry(v1Elements, v1Reactions)
  readonly view: WorldView
  readonly #worker: Worker
  readonly #witnesses = new WitnessChannel()

  /**
   * The worker is constructed through a factory for the same reason
   * `LocalSimHost` takes its clock: vitest cannot run a worker thread, and the
   * host's whole job here is relaying, which a fake is enough to pin.
   */
  constructor(
    createWorker: () => Worker = () =>
      new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' }),
  ) {
    const world = createSharedWorld()
    this.view = new WorldView(world)
    this.#worker = createWorker()
    // The world itself never travels, so this is the only traffic coming back.
    this.#worker.onmessage = (event: MessageEvent<SimPageMessage>) => {
      this.#witnesses.deliver(event.data)
    }
    const init: SimWorkerInit = { type: 'init', world }
    this.#worker.postMessage(init)
  }

  send(message: SimWorkerMessage): void {
    this.#worker.postMessage(message)
  }

  onWitnessed(listener: WitnessListener): () => void {
    return this.#witnesses.subscribe(listener)
  }

  dispose(): void {
    this.#worker.terminate()
  }
}

/** Just the environment facts selection needs — pure, so vitest can drive it. */
export function selectSimHostKind(env: {
  crossOriginIsolated: boolean
  hasWorker: boolean
}): 'local' | 'worker' {
  // Isolation is what makes SharedArrayBuffer exist in a browser; without it
  // (headers stripped by a proxy, an embedded context) the sim stays on the
  // main thread and everything still works.
  return env.crossOriginIsolated && env.hasWorker ? 'worker' : 'local'
}

export function createSimHost(): SimHost {
  const kind = selectSimHostKind({
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    hasWorker: typeof Worker !== 'undefined',
  })
  return kind === 'worker' ? new WorkerSimHost() : new LocalSimHost()
}
