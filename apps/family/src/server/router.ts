import {
  addChildInput,
  deleteAccountInput,
  deleteChildInput,
  mintSessionTokenInput,
  renameChildInput,
  saveDeleteInput,
  saveGetInput,
  saveListInput,
  savePutInput,
  type FamilyIdentityRouterContract,
  type FamilySaveContract,
} from '@hoe/accounts'
import { createTRPC } from '@hoe/backend-kit'

import type { FamilyTokenMinter } from './auth/tokenPort.ts'
import type { FamilyContext } from './handlers/authz.ts'
import { GreetingHandler } from './handlers/greetingHandler.ts'
import { AddChildHandler } from './handlers/identity/addChildHandler.ts'
import { DeleteAccountHandler } from './handlers/identity/deleteAccountHandler.ts'
import { DeleteChildHandler } from './handlers/identity/deleteChildHandler.ts'
import { ListChildrenHandler } from './handlers/identity/listChildrenHandler.ts'
import { MeHandler } from './handlers/identity/meHandler.ts'
import { MintSessionTokenHandler } from './handlers/identity/mintSessionTokenHandler.ts'
import { RenameChildHandler } from './handlers/identity/renameChildHandler.ts'
import { DeleteSaveHandler } from './handlers/saves/deleteSaveHandler.ts'
import { GetSaveHandler } from './handlers/saves/getSaveHandler.ts'
import { ListSavesHandler } from './handlers/saves/listSavesHandler.ts'
import { PutSaveHandler } from './handlers/saves/putSaveHandler.ts'
import type { FamilyStore } from './store.ts'

export interface FamilyRouterDeps {
  /** Closes over FAMILY_TOKEN_PRIVATE_KEY; browser-unsafe (node:crypto). */
  mintToken: FamilyTokenMinter
}

const t = createTRPC<FamilyStore>()

/**
 * The identity half, bound to one request's context. The `satisfies` is the
 * point: it makes a divergence between these handlers and the contract hub's
 * client speaks a compile error here rather than a 400 somebody meets in a
 * browser.
 */
function identityContractFor(ctx: FamilyContext, mintToken: FamilyTokenMinter) {
  return {
    me: () => new MeHandler().run(undefined, ctx),
    listChildren: () => new ListChildrenHandler().run(undefined, ctx),
    addChild: (input) => new AddChildHandler().run(input, ctx),
    renameChild: (input) => new RenameChildHandler().run(input, ctx),
    deleteChild: (input) => new DeleteChildHandler().run(input, ctx),
    mintSessionToken: (input) => new MintSessionTokenHandler(mintToken).run(input, ctx),
    deleteAccount: () => new DeleteAccountHandler().run(undefined, ctx),
  } satisfies FamilyIdentityRouterContract
}

/** The save half, bound to one request's context, as `@hoe/accounts` types it. */
function saveContractFor(ctx: FamilyContext) {
  return {
    get: (input) => new GetSaveHandler().run(input, ctx),
    put: (input) => new PutSaveHandler().run(input, ctx),
    list: (input) => new ListSavesHandler().run(input, ctx),
    delete: (input) => new DeleteSaveHandler().run(input, ctx),
  } satisfies FamilySaveContract
}

/**
 * A factory, not a const: the composition roots (main.ts / simulator.ts /
 * IwftApp.tsx) inject the minter, which cannot come from the AppContext seam.
 */
export function createAppRouter(deps: FamilyRouterDeps) {
  return t.router({
    greeting: t.procedure.query(({ ctx }) => new GreetingHandler().run(undefined, ctx)),
    identity: t.router({
      me: t.procedure.query(({ ctx }) => identityContractFor(ctx, deps.mintToken).me()),
      children: t.router({
        list: t.procedure.query(({ ctx }) =>
          identityContractFor(ctx, deps.mintToken).listChildren(),
        ),
        add: t.procedure
          .input(addChildInput)
          .mutation(({ input, ctx }) => identityContractFor(ctx, deps.mintToken).addChild(input)),
        rename: t.procedure
          .input(renameChildInput)
          .mutation(({ input, ctx }) =>
            identityContractFor(ctx, deps.mintToken).renameChild(input),
          ),
        delete: t.procedure
          .input(deleteChildInput)
          .mutation(({ input, ctx }) =>
            identityContractFor(ctx, deps.mintToken).deleteChild(input),
          ),
      }),
      mintSessionToken: t.procedure
        .input(mintSessionTokenInput)
        .mutation(({ input, ctx }) =>
          identityContractFor(ctx, deps.mintToken).mintSessionToken(input),
        ),
      // The parser is what makes tRPC read the body at all (ADR 0078 decision 5),
      // so it stays on the procedure even though the handler ignores its value.
      deleteAccount: t.procedure
        .input(deleteAccountInput)
        .mutation(({ ctx }) => identityContractFor(ctx, deps.mintToken).deleteAccount()),
    }),
    save: t.router({
      get: t.procedure
        .input(saveGetInput)
        .query(({ input, ctx }) => saveContractFor(ctx).get(input)),
      put: t.procedure
        .input(savePutInput)
        .mutation(({ input, ctx }) => saveContractFor(ctx).put(input)),
      list: t.procedure
        .input(saveListInput)
        .query(({ input, ctx }) => saveContractFor(ctx).list(input)),
      delete: t.procedure
        .input(saveDeleteInput)
        .mutation(({ input, ctx }) => saveContractFor(ctx).delete(input)),
    }),
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
