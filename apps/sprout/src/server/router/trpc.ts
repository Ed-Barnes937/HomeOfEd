// The ONE tRPC instance every router group shares (plan §5.1). Group files
// (children.ts, childAuth.ts, …) import `t`/`publicProcedure` from here so all
// procedures live under a single `initTRPC` instance; `router.ts` composes the
// group routers into `appRouter`.
//
// Do NOT create another `createTRPC<SproutStore>()` in a group file — tRPC
// requires all procedures to descend from one instance.
import { createTRPC } from '@hoe/backend-kit'

import type { SproutStore } from '../store.ts'

export const t = createTRPC<SproutStore>()
export const publicProcedure = t.procedure
export const router = t.router
