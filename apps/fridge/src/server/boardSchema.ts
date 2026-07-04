import { z } from 'zod'

/** Magnet kinds in v1 — letters, numbers, fraction discs (no word tiles). */
export const magnetTypeSchema = z.enum(['letter', 'number', 'fraction'])

/** The six magnet colours (model.ts's PALETTE_ORDER is the auto-cycle order). */
export const paletteKeySchema = z.enum(['red', 'blue', 'green', 'yellow', 'orange', 'purple'])

/** Fridge door finish; `steel` is the bare door, the rest are overlays. */
export const finishSchema = z.enum(['steel', 'white', 'red', 'mint'])

/** Kitchen-light tint over the whole page. */
export const wallSchema = z.enum(['warm', 'cool', 'dark'])

const DEG_VALUES = [0, 90, 120, 180, 270, 360] as const

/**
 * A magnet as persisted — localStorage today, share payloads in phase 3
 * (plan §5/§8). `w`/`h`/`z`/`id` are DERIVED at load time (model.ts's
 * `sizeFor` + array order), never stored, so a malformed/hostile payload
 * can't create absurd boxes.
 */
export const storedMagnetSchema = z.object({
  type: magnetTypeSchema,
  label: z.string().regex(/^[A-Z0-9]?$/),
  deg: z.number().refine((v) => (DEG_VALUES as readonly number[]).includes(v), {
    message: 'deg must be one of 0, 90, 120, 180, 270, 360',
  }),
  color: paletteKeySchema,
  x: z.number().int().min(-50).max(5000),
  y: z.number().int().min(-50).max(5000),
  // Normalised to [0,360) on save — wheel rotation is otherwise unbounded.
  rot: z.number().finite().min(0).lt(360),
})

/**
 * A whole board. One schema validates both localStorage reads (today) and
 * share payloads server-side (phase 3) — the caps here (name length, magnet
 * count) are the abuse guard for the latter.
 */
export const storedBoardSchema = z.object({
  name: z.string().max(60),
  magnets: z.array(storedMagnetSchema).max(200),
  finish: finishSchema,
  wall: wallSchema,
})

export type StoredMagnet = z.infer<typeof storedMagnetSchema>
export type StoredBoard = z.infer<typeof storedBoardSchema>
