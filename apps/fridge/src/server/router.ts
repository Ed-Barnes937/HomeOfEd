import { createTRPC } from '@hoe/backend-kit'

import { storedBoardSchema } from './boardSchema.ts'
import { GetBoardHandler, getBoardInputSchema } from './handlers/getBoardHandler.ts'
import { HealthHandler } from './handlers/healthHandler.ts'
import { ShareBoardHandler } from './handlers/shareBoardHandler.ts'
import type { FridgeStore } from './store.ts'

// Shared boards live in Postgres (ADR 0010), so the Store type parameter is
// FridgeStore. health round-trips the Store; board.share/board.get publish
// and fetch immutable snapshots (ADR 0010). The share/import UI wires these
// up from the frontend in F12.
const t = createTRPC<FridgeStore>()

export const appRouter = t.router({
  health: t.procedure.query(({ ctx }) => new HealthHandler().run(undefined, ctx)),
  board: t.router({
    share: t.procedure
      .input(storedBoardSchema)
      .mutation(({ input, ctx }) => new ShareBoardHandler().run(input, ctx)),
    get: t.procedure
      .input(getBoardInputSchema)
      .query(({ input, ctx }) => new GetBoardHandler().run(input, ctx)),
  }),
})

/** Exported for all three transports; the share/import UI wires in F12. */
export type AppRouter = typeof appRouter
