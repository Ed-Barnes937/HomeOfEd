import { GreetingHandler } from './handlers/greetingHandler.ts'
import type { RouterDeps } from './router/deps.ts'
import { childAuthRouter } from './router/childAuth.ts'
import { createChildrenRouter } from './router/children.ts'
import { conversationsRouter } from './router/conversations.ts'
import { flagsRouter } from './router/flags.ts'
import { publicProcedure, t } from './router/trpc.ts'

// The composed tRPC surface (plan §5.1). Each group lives in its own file under
// `router/` and is built from the ONE shared `t` (router/trpc.ts) so the P3b
// squad can fill childAuth/conversations/flags in parallel. `children` is fully
// implemented (the reference group); the others are compiling stubs carrying a
// P3b checklist.
//
// This is a FACTORY (not a const): the composition root injects `RouterDeps`
// (the PasswordHasher — browser-unsafe node:crypto — and the pipeline
// summariser). `children` consumes `deps`; the stubs don't yet.
//
// P3b note: when childAuth/conversations need a dep (childAuth hashes passwords;
// conversations.summariseAndPurge calls `deps.summarise`), convert that stub to
// a factory `createXRouter(deps)` and change its ONE line below to pass `deps`.
// That single wiring line is the ONLY sanctioned edit to this file per group —
// do not touch other groups' wiring, trpc.ts, or the deps shape.
//
// `greeting` is retained P0 scaffolding — it keeps the app building and the
// greeting `.iwft` passing until the real screens land (P4). Remove it then.
export function createAppRouter(deps: RouterDeps) {
  return t.router({
    greeting: publicProcedure.query(({ ctx }) => new GreetingHandler().run(undefined, ctx)),
    children: createChildrenRouter(deps),
    childAuth: childAuthRouter,
    conversations: conversationsRouter,
    flags: flagsRouter,
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
