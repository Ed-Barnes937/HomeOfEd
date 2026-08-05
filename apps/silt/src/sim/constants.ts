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

/**
 * Chunk edge length in cells (spec §5.3). A tunable, not a commitment — prior
 * art spans two orders of magnitude. 32 gives a 10×7 grid over 300×200, which
 * is coarse enough that most activity stays inside one chunk and fine enough
 * that a settled world sleeps almost entirely.
 */
export const CHUNK_SIZE = 32

/**
 * Cells of slack added around every write when marking a chunk dirty. Two is
 * the winter.dev figure: it covers the neighbourhood any kernel can read or
 * write in one step, plus one, so waking a chunk can never miss a cell that
 * the change made eligible to move.
 */
export const CHUNK_MARGIN = 2

/**
 * Longest life an element may declare, `ticks + jitter`. The countdown lives in
 * the one `ra` byte, so this is a hard ceiling the registry enforces at boot —
 * not a clamp applied behind the author's back.
 */
export const MAX_LIFETIME_TICKS = 255

/** Sim steps per second; the tick is fixed-timestep and render-independent. */
export const TICKS_PER_SECOND = 60
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND
