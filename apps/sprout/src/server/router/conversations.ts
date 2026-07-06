// conversations.* — the child chat surface + the dashboard's conversation
// reads (plan §5.1). REFERENCE: `router/children.ts` for the factory shape.
//
// WIRING — this is a factory (needs `deps.summarise` for summariseAndPurge),
// exactly like `children`. The orchestrator composing `router.ts` must change
// ONE line, from:
//   conversations: conversationsRouter,
// to:
//   conversations: createConversationsRouter(deps),
// (and drop the now-unused `conversationsRouter` import).
//
// AUTH SHAPE (see handlers/conversations/access.ts + handlers/authz.ts):
//   - create, saveMessage: CHILD-scoped, `childId` derived from `ctx.auth`
//     only, never input (#36) — the source endpoints trusted a client-supplied
//     `childId` with no auth at all.
//   - list, messages, summary: dual-role reads — the owning PARENT
//     (dashboard) OR the conversation's own CHILD (chat history) — source's
//     `useChat` (child) and the parent conversation-detail page hit the same
//     underlying endpoints.
//   - delete: dual-role too (see the handler doc — source's delete button is
//     child-only in practice, kept open to the owning parent as well).
//   - summariseAndPurge: PARENT-only (`verifyConversationOwnership`) — no
//     caller evidence in source either way; kept conservative as a
//     destructive/compliance action.
import {
  CreateConversationHandler,
  createConversationInputSchema,
} from '../handlers/conversations/createConversationHandler.ts'
import {
  DeleteConversationHandler,
  deleteConversationInputSchema,
} from '../handlers/conversations/deleteConversationHandler.ts'
import {
  GetConversationSummaryHandler,
  getConversationSummaryInputSchema,
} from '../handlers/conversations/getConversationSummaryHandler.ts'
import {
  ListConversationsHandler,
  listConversationsInputSchema,
} from '../handlers/conversations/listConversationsHandler.ts'
import {
  ListMessagesHandler,
  listMessagesInputSchema,
} from '../handlers/conversations/listMessagesHandler.ts'
import {
  SaveMessageHandler,
  saveMessageInputSchema,
} from '../handlers/conversations/saveMessageHandler.ts'
import {
  SummariseAndPurgeHandler,
  summariseAndPurgeInputSchema,
} from '../handlers/conversations/summariseAndPurgeHandler.ts'
import type { RouterDeps } from './deps.ts'
import { publicProcedure, router } from './trpc.ts'

export function createConversationsRouter(deps: RouterDeps) {
  return router({
    create: publicProcedure
      .input(createConversationInputSchema)
      .mutation(({ input, ctx }) => new CreateConversationHandler().run(input, ctx)),
    list: publicProcedure
      .input(listConversationsInputSchema)
      .query(({ input, ctx }) => new ListConversationsHandler().run(input, ctx)),
    messages: publicProcedure
      .input(listMessagesInputSchema)
      .query(({ input, ctx }) => new ListMessagesHandler().run(input, ctx)),
    saveMessage: publicProcedure
      .input(saveMessageInputSchema)
      .mutation(({ input, ctx }) => new SaveMessageHandler().run(input, ctx)),
    summary: publicProcedure
      .input(getConversationSummaryInputSchema)
      .query(({ input, ctx }) => new GetConversationSummaryHandler().run(input, ctx)),
    summariseAndPurge: publicProcedure
      .input(summariseAndPurgeInputSchema)
      .mutation(({ input, ctx }) => new SummariseAndPurgeHandler(deps.summarise).run(input, ctx)),
    delete: publicProcedure
      .input(deleteConversationInputSchema)
      .mutation(({ input, ctx }) => new DeleteConversationHandler().run(input, ctx)),
  })
}
