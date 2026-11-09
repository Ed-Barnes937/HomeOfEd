import { createTRPC } from '@hoe/backend-kit'

import type { FamilyTokenMinter } from './auth/tokenPort.ts'
import { GreetingHandler } from './handlers/greetingHandler.ts'
import { AddChildHandler, addChildInputSchema } from './handlers/identity/addChildHandler.ts'
import { DeleteAccountHandler } from './handlers/identity/deleteAccountHandler.ts'
import {
  DeleteChildHandler,
  deleteChildInputSchema,
} from './handlers/identity/deleteChildHandler.ts'
import { ListChildrenHandler } from './handlers/identity/listChildrenHandler.ts'
import { MeHandler } from './handlers/identity/meHandler.ts'
import {
  MintSessionTokenHandler,
  mintSessionTokenInputSchema,
} from './handlers/identity/mintSessionTokenHandler.ts'
import {
  RenameChildHandler,
  renameChildInputSchema,
} from './handlers/identity/renameChildHandler.ts'
import type { FamilyStore } from './store.ts'

export interface FamilyRouterDeps {
  /** Closes over FAMILY_TOKEN_PRIVATE_KEY; browser-unsafe (node:crypto). */
  mintToken: FamilyTokenMinter
}

const t = createTRPC<FamilyStore>()

/**
 * A factory, not a const: the composition roots (main.ts / simulator.ts /
 * IwftApp.tsx) inject the minter, which cannot come from the AppContext seam.
 */
export function createAppRouter(deps: FamilyRouterDeps) {
  return t.router({
    greeting: t.procedure.query(({ ctx }) => new GreetingHandler().run(undefined, ctx)),
    identity: t.router({
      me: t.procedure.query(({ ctx }) => new MeHandler().run(undefined, ctx)),
      children: t.router({
        list: t.procedure.query(({ ctx }) => new ListChildrenHandler().run(undefined, ctx)),
        add: t.procedure
          .input(addChildInputSchema)
          .mutation(({ input, ctx }) => new AddChildHandler().run(input, ctx)),
        rename: t.procedure
          .input(renameChildInputSchema)
          .mutation(({ input, ctx }) => new RenameChildHandler().run(input, ctx)),
        delete: t.procedure
          .input(deleteChildInputSchema)
          .mutation(({ input, ctx }) => new DeleteChildHandler().run(input, ctx)),
      }),
      mintSessionToken: t.procedure
        .input(mintSessionTokenInputSchema)
        .mutation(({ input, ctx }) => new MintSessionTokenHandler(deps.mintToken).run(input, ctx)),
      deleteAccount: t.procedure.mutation(({ ctx }) =>
        new DeleteAccountHandler().run(undefined, ctx),
      ),
    }),
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
