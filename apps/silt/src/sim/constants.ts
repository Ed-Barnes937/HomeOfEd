/**
 * Fixed logical world (spec §6). Build-time constants — never viewport-derived,
 * never user-configurable. They may grow later (e.g. 600×400); the scene format
 * stores dimensions in its header so old scenes stay loadable.
 */
export const GRID_WIDTH = 300
export const GRID_HEIGHT = 200

/** `{ species, ra, rb, clock }` — one interleaved 4-byte struct per cell. */
export const BYTES_PER_CELL = 4

export const SPECIES_OFFSET = 0
export const RA_OFFSET = 1
export const RB_OFFSET = 2
export const CLOCK_OFFSET = 3

/** Sim steps per second; the tick is fixed-timestep and render-independent. */
export const TICKS_PER_SECOND = 60
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND
