import { ConflictError, Handler, type AppContext } from '@hoe/backend-kit'

import type { StoredBoard } from '../boardSchema.ts'
import { randomShareId } from '../idGen.ts'
import type { FridgeStore } from '../store.ts'

export interface ShareBoardResult {
  id: string
}

const MAX_ATTEMPTS = 3 // one try + two retries on an id collision (ADR 0010)

/**
 * Publishes an immutable snapshot (ADR 0010). The router validates the input
 * through `storedBoardSchema` before this ever runs, so `input` is already a
 * well-formed `StoredBoard` — this handler's job is just id generation and
 * the insert-conflict retry. `idGen` is injected (crypto-random in prod) so
 * tests can pin a deterministic sequence, the same seam shape as `ctx.now()`.
 */
export class ShareBoardHandler extends Handler<StoredBoard, ShareBoardResult, FridgeStore> {
  private readonly idGen: () => string

  constructor(idGen: () => string = randomShareId) {
    super()
    this.idGen = idGen
  }

  async run(input: StoredBoard, ctx: AppContext<FridgeStore>): Promise<ShareBoardResult> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const id = this.idGen()
      try {
        await ctx.store.insertSharedBoard(id, input.name, input)
        return { id }
      } catch {
        // The store's only documented throw is a primary-key (id) collision —
        // vanishingly unlikely across 62^10 ids, but retry with a fresh one.
        ctx.logger.debug('share.idConflict', { attempt })
      }
    }
    throw new ConflictError('could not generate a unique share id')
  }
}
