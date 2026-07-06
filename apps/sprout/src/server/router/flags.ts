// flags.* — the parent dashboard's flag review surface + the chat-path write
// (plan §5.1). No injected deps needed (unlike children's PasswordHasher), so
// this is a plain exported router, not a factory.
//
// ORCHESTRATOR: wire this into router.ts's appRouter as:
//   flags: flagsRouter
import { CreateFlagHandler, createFlagInputSchema } from '../handlers/flags/createFlagHandler.ts'
import { ListFlagsHandler, listFlagsInputSchema } from '../handlers/flags/listFlagsHandler.ts'
import { ReviewFlagHandler, reviewFlagInputSchema } from '../handlers/flags/reviewFlagHandler.ts'
import { publicProcedure, router } from './trpc.ts'

export const flagsRouter = router({
  list: publicProcedure
    .input(listFlagsInputSchema)
    .query(({ input, ctx }) => new ListFlagsHandler().run(input, ctx)),
  create: publicProcedure
    .input(createFlagInputSchema)
    .mutation(({ input, ctx }) => new CreateFlagHandler().run(input, ctx)),
  review: publicProcedure
    .input(reviewFlagInputSchema)
    .mutation(({ input, ctx }) => new ReviewFlagHandler().run(input, ctx)),
})
