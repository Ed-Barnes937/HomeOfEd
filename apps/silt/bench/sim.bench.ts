// A tool, not a gate. `pnpm --filter silt run bench` builds a Sim, drives each
// scenario and prints ms/tick, so a ticket that claims a speed-up has something
// to claim it against. Deliberately outside `pnpm test`: a timing assertion in
// CI would only flake.
//
// Runs under `node --experimental-strip-types`, like `src/server/main.ts`, so
// it sticks to erasable TS syntax (ADR 0004).
//
// `scannedLastTick` is printed beside every timing on purpose. A scenario that
// got faster because it stopped simulating is not a win, and the scanned count
// is the only thing that tells the two apart — two of the audit's first
// scenarios (all-water, all-sand) settled during the warm-up and measured
// nothing but loop overhead.
import { emitSpawners, type Spawner } from '../src/features/spawners/spawners.ts'
import {
  ACID,
  DIRT,
  FIRE,
  GRID_HEIGHT,
  GRID_WIDTH,
  LAVA,
  MUD,
  OIL,
  SAND,
  SEED,
  Sim,
  STONE,
  WATER,
  WOOD,
} from '../src/sim/index.ts'

const WARMUP_TICKS = 200
const MEASURED_TICKS = 1500

interface Scenario {
  name: string
  /** Painted once, before the warm-up. */
  setup: (sim: Sim) => void
  /** Run before every tick, warm-up included. Absent = leave the world alone. */
  perTick?: (sim: Sim) => void
}

function fill(sim: Sim, x0: number, y0: number, x1: number, y1: number, species: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      sim.paint(x, y, species)
    }
  }
}

const FLOOR_TOP = GRID_HEIGHT - 3
const RIGHT = GRID_WIDTH - 1

/** Stone floor, water pool, wood block, dirt bank — the audit's mixed world. */
function mixedWorld(sim: Sim): void {
  fill(sim, 0, FLOOR_TOP, RIGHT, GRID_HEIGHT - 1, STONE)
  fill(sim, 20, 175, 90, FLOOR_TOP - 1, WATER)
  fill(sim, 120, 180, 170, FLOOR_TOP - 1, WOOD)
  fill(sim, 200, 170, 290, FLOOR_TOP - 1, DIRT)
}

const mixedSpawners: readonly Spawner[] = [
  { x: 40, y: 5, element: SAND },
  { x: 100, y: 5, element: WATER },
  { x: 150, y: 5, element: OIL },
  { x: 210, y: 5, element: SAND },
  { x: 260, y: 5, element: WATER },
]

const churnSpawners: readonly Spawner[] = [
  { x: 60, y: 148, element: FIRE },
  { x: 200, y: 148, element: FIRE },
  { x: 120, y: 110, element: LAVA },
  { x: 90, y: 40, element: ACID },
  { x: 240, y: 40, element: ACID },
]

const scenarios: readonly Scenario[] = [
  {
    name: 'spawners + mixed world',
    setup: mixedWorld,
    perTick: (sim) => {
      emitSpawners(sim, mixedSpawners)
    },
  },
  {
    name: 'reaction churn',
    setup: (sim) => {
      fill(sim, 0, FLOOR_TOP, RIGHT, GRID_HEIGHT - 1, STONE)
      fill(sim, 30, 150, 270, FLOOR_TOP - 1, WOOD)
    },
    perTick: (sim) => {
      emitSpawners(sim, churnSpawners)
    },
  },
  {
    // The burnables case none of the rows above reaches: a *whole screen* of
    // wood alight at once (burnables ticket 04; ADR 0042 named this as the
    // gap). "Reaction churn" pours fire onto a wood slab, but the burn there
    // stays a local front and only ~2k cells are ever awake. A smoldering mass
    // is awake by construction - a lifetime writes `ra` every tick - so the
    // number this row exists to print is `scanned`, which sits five to eight
    // times higher.
    //
    // Lit along the whole top edge rather than at a corner, which is what makes
    // it a steady state over the measured window instead of a ramp: measured,
    // the front holds ~4.3k embers and ~1.3k flames from tick 250 to the end
    // while the wood drains roughly linearly, so every tick of the window is
    // paid for by a real burn rather than by drifting smoke.
    name: 'wood world ablaze',
    setup: (sim) => {
      fill(sim, 0, FLOOR_TOP, RIGHT, GRID_HEIGHT - 1, STONE)
      fill(sim, 0, 20, RIGHT, FLOOR_TOP - 1, WOOD)
      for (let x = 0; x <= RIGHT; x += 6) {
        sim.paint(x, 20, FIRE)
      }
    },
  },
  {
    name: 'plant growth',
    setup: (sim) => {
      fill(sim, 0, FLOOR_TOP, RIGHT, GRID_HEIGHT - 1, STONE)
      fill(sim, 0, 190, RIGHT, FLOOR_TOP - 1, MUD)
      fill(sim, 0, 40, RIGHT, 188, WATER)
      for (let x = 4; x < GRID_WIDTH; x += 9) {
        sim.paint(x, 189, SEED)
      }
    },
  },
  {
    // The sleep-path guard: the same world, left alone. If a later change stops
    // a settled world sleeping, this row is where it shows up.
    name: 'settled world',
    setup: mixedWorld,
  },
]

interface Result {
  name: string
  msPerTick: number
  scanned: number
}

function run(scenario: Scenario): Result {
  const sim = new Sim()
  scenario.setup(sim)

  for (let i = 0; i < WARMUP_TICKS; i++) {
    scenario.perTick?.(sim)
    sim.tick()
  }

  const start = performance.now()
  for (let i = 0; i < MEASURED_TICKS; i++) {
    scenario.perTick?.(sim)
    sim.tick()
  }
  const elapsed = performance.now() - start

  return {
    name: scenario.name,
    msPerTick: elapsed / MEASURED_TICKS,
    scanned: sim.scannedLastTick,
  }
}

const results = scenarios.map(run)
const nameWidth = Math.max(...results.map((r) => r.name.length))

console.log(
  `${WARMUP_TICKS} warm-up ticks, ${MEASURED_TICKS} measured, ${GRID_WIDTH}×${GRID_HEIGHT}`,
)
console.log('')
for (const result of results) {
  const timing = `${result.msPerTick.toFixed(3)} ms/tick`.padStart(16)
  console.log(`${result.name.padEnd(nameWidth)}${timing}   scanned=${result.scanned}`)
}
