import { Handler, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import { storedBoardSchema, type StoredBoard } from '../boardSchema.ts'
import type { FridgeStore } from '../store.ts'

/** 10-char base62 (ADR 0010) — the router validates this before `run()` sees it. */
export const getBoardInputSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9]{10}$/) })
export type GetBoardInput = z.infer<typeof getBoardInputSchema>

/**
 * Fetches a shared snapshot (ADR 0010). Returns the payload alone — `name` is
 * also a column on the row for a possible future listing, but v1 reads it
 * from the payload (the payload's own `name` field), per the ADR.
 */
export class GetBoardHandler extends Handler<GetBoardInput, StoredBoard, FridgeStore> {
  async run(input: GetBoardInput, ctx: AppContext<FridgeStore>): Promise<StoredBoard> {
    const row = await ctx.store.getSharedBoard(input.id)
    if (!row) throw new NotFoundError(`no shared board with id "${input.id}"`)
    // Re-validate on the way out: a row that somehow went bad can't reach a client.
    return storedBoardSchema.parse(row.payload)
  }
}
