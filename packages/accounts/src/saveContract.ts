// accountId is absent from every input on purpose: the service derives it
// from the verified token in ctx.auth.
import { z } from 'zod'

export const saveGetInput = z.object({
  appId: z.string().min(1),
  slotKey: z.string().min(1),
})

export const savePutInput = saveGetInput.extend({
  // A localStorage value, so always a string. The server never parses it.
  blob: z.string(),
})

export const saveListInput = z.object({ appId: z.string().min(1) })

export const saveDeleteInput = saveGetInput

/** Timestamps are epoch ms, so the wire needs no tRPC transformer. */
export const saveSlotMeta = z.object({
  slotKey: z.string(),
  version: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.number(),
})

export const saveGetOutput = z
  .object({
    blob: z.string(),
    version: z.number().int().positive(),
    updatedAt: z.number(),
  })
  .nullable()

/** Unconditional overwrite; the server increments the version. */
export const savePutOutput = z.object({ version: z.number().int().positive() })

export const saveListOutput = z.array(saveSlotMeta)

export const saveDeleteOutput = z.object({})

export type SaveGetInput = z.infer<typeof saveGetInput>
export type SavePutInput = z.infer<typeof savePutInput>
export type SaveListInput = z.infer<typeof saveListInput>
export type SaveDeleteInput = z.infer<typeof saveDeleteInput>
export type SaveSlotMeta = z.infer<typeof saveSlotMeta>
export type SaveGetOutput = z.infer<typeof saveGetOutput>
export type SavePutOutput = z.infer<typeof savePutOutput>
export type SaveListOutput = z.infer<typeof saveListOutput>
export type SaveDeleteOutput = z.infer<typeof saveDeleteOutput>

export interface FamilySaveContract {
  get(input: SaveGetInput): Promise<SaveGetOutput>
  put(input: SavePutInput): Promise<SavePutOutput>
  list(input: SaveListInput): Promise<SaveListOutput>
  delete(input: SaveDeleteInput): Promise<SaveDeleteOutput>
}
