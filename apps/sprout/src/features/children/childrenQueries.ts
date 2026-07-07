// children.* query-option factories + mutation fns over the tRPC client
// (replaces the source `api/children.ts` + `queries/children.ts`). Types infer
// from the router — no hand-written DTOs. Identity (parentId) is derived
// server-side from `ctx.auth`, so `children.list`/`create` take no parentId.
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export type ChildSummary = Awaited<ReturnType<typeof trpcClient.children.list.query>>[number]
export type ChildConfig = Awaited<ReturnType<typeof trpcClient.children.config.query>>
export type ChildStats = Awaited<ReturnType<typeof trpcClient.children.stats.query>>
export type CreateChildInput = Parameters<typeof trpcClient.children.create.mutate>[0]
export type UpdateChildInput = Parameters<typeof trpcClient.children.update.mutate>[0]
export type UpdatePresetInput = Parameters<typeof trpcClient.children.preset.mutate>[0]

/** children.list — every child the authenticated parent owns. */
export const childrenQueryOptions = queryOptions({
  queryKey: ['children'],
  queryFn: () => trpcClient.children.list.query(),
})

export function childConfigQueryOptions(childId: string) {
  return queryOptions({
    queryKey: ['child-config', childId],
    queryFn: () => trpcClient.children.config.query({ childId }),
  })
}

export function childStatsQueryOptions(childId: string) {
  return queryOptions({
    queryKey: ['child-stats', childId],
    queryFn: () => trpcClient.children.stats.query({ childId }),
  })
}

export const createChild = (input: CreateChildInput) => trpcClient.children.create.mutate(input)
export const updateChild = (input: UpdateChildInput) => trpcClient.children.update.mutate(input)
export const updatePreset = (input: UpdatePresetInput) => trpcClient.children.preset.mutate(input)
