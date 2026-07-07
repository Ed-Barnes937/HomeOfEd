// children.* — the parent dashboard's child-management surface (plan §5.1) and
// the REFERENCE implementation for the P3b squad: every procedure derives
// `parentId` from `ctx.auth` and proves ownership via `verifyChildOwnership`
// before touching a child's data. Copy this shape for the other groups.
import { AddTopicHandler, addTopicInputSchema } from '../handlers/children/addTopicHandler.ts'
import {
  CreateChildHandler,
  createChildInputSchema,
} from '../handlers/children/createChildHandler.ts'
import {
  GetChildConfigHandler,
  getChildConfigInputSchema,
} from '../handlers/children/getChildConfigHandler.ts'
import { GetChildHandler, getChildInputSchema } from '../handlers/children/getChildHandler.ts'
import {
  GetChildStatsHandler,
  getChildStatsInputSchema,
} from '../handlers/children/getChildStatsHandler.ts'
import { ListChildrenHandler } from '../handlers/children/listChildrenHandler.ts'
import { ListTopicsHandler, listTopicsInputSchema } from '../handlers/children/listTopicsHandler.ts'
import { MyConfigHandler } from '../handlers/children/myConfigHandler.ts'
import {
  RemoveTopicHandler,
  removeTopicInputSchema,
} from '../handlers/children/removeTopicHandler.ts'
import {
  UpdateCalibrationHandler,
  updateCalibrationInputSchema,
} from '../handlers/children/updateCalibrationHandler.ts'
import { UpdateChildHandler, updateChildInputSchema } from '../handlers/children/updateChildHandler.ts'
import {
  UpdatePresetHandler,
  updatePresetInputSchema,
} from '../handlers/children/updatePresetHandler.ts'
import type { RouterDeps } from './deps.ts'
import { publicProcedure, router } from './trpc.ts'

// A factory (not a const) so the composition root injects the PasswordHasher
// (create/update hash a PIN/password — node:crypto, browser-unsafe). The `.iwft`
// harness passes a browser-safe fake; prod/dev pass scrypt.
export function createChildrenRouter(deps: RouterDeps) {
  return router({
    list: publicProcedure.query(({ ctx }) => new ListChildrenHandler().run(undefined, ctx)),
    get: publicProcedure
      .input(getChildInputSchema)
      .query(({ input, ctx }) => new GetChildHandler().run(input, ctx)),
    create: publicProcedure
      .input(createChildInputSchema)
      .mutation(({ input, ctx }) =>
        new CreateChildHandler({ hasher: deps.hasher }).run(input, ctx),
      ),
    update: publicProcedure
      .input(updateChildInputSchema)
      .mutation(({ input, ctx }) => new UpdateChildHandler(deps.hasher).run(input, ctx)),
    config: publicProcedure
      .input(getChildConfigInputSchema)
      .query(({ input, ctx }) => new GetChildConfigHandler().run(input, ctx)),
    // Child-scoped self-read (#36): the authenticated child's own config, for
    // the chat client's session-limit gate. No input — identity is ctx.auth.
    myConfig: publicProcedure.query(({ ctx }) => new MyConfigHandler().run(undefined, ctx)),
    stats: publicProcedure
      .input(getChildStatsInputSchema)
      .query(({ input, ctx }) => new GetChildStatsHandler().run(input, ctx)),
    preset: publicProcedure
      .input(updatePresetInputSchema)
      .mutation(({ input, ctx }) => new UpdatePresetHandler().run(input, ctx)),
    calibration: publicProcedure
      .input(updateCalibrationInputSchema)
      .mutation(({ input, ctx }) => new UpdateCalibrationHandler().run(input, ctx)),
    topics: router({
      list: publicProcedure
        .input(listTopicsInputSchema)
        .query(({ input, ctx }) => new ListTopicsHandler().run(input, ctx)),
      add: publicProcedure
        .input(addTopicInputSchema)
        .mutation(({ input, ctx }) => new AddTopicHandler().run(input, ctx)),
      remove: publicProcedure
        .input(removeTopicInputSchema)
        .mutation(({ input, ctx }) => new RemoveTopicHandler().run(input, ctx)),
    }),
  })
}
