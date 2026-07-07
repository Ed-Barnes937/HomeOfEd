import { createChildAuthRouter } from './router/childAuth.ts'
import { createChildrenRouter } from './router/children.ts'
import { createConversationsRouter } from './router/conversations.ts'
import type { RouterDeps } from './router/deps.ts'
import { flagsRouter } from './router/flags.ts'
import { t } from './router/trpc.ts'

// The composed tRPC surface (plan §5.1). Each group lives in its own file under
// `router/` and is built from the ONE shared `t` (router/trpc.ts). `children`,
// `childAuth` and `conversations` are factories — the composition root injects
// `RouterDeps` (the PasswordHasher and child-token minter, both browser-unsafe
// node:crypto, plus the pipeline summariser). `flags` needs no deps, so it is a
// plain router.
//
// This is a FACTORY (not a const): the composition roots (main.ts /
// simulator.ts / IwftApp.tsx) build a `RouterDeps` and pass it here.
//
// P4 removed the `greeting` scaffold procedure now that the real screens +
// their `.iwft` coverage exist (it was only ever the P0 verify signal).
export function createAppRouter(deps: RouterDeps) {
  return t.router({
    children: createChildrenRouter(deps),
    childAuth: createChildAuthRouter(deps),
    conversations: createConversationsRouter(deps),
    flags: flagsRouter,
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
