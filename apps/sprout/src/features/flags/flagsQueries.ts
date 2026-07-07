// flags.* — parent flag-review surface (replaces `api/flags.ts` +
// `queries/flags.ts`). `flags.list` returns every flag across the parent's
// owned children (childId is NOT trusted server-side — #35); the per-child
// filter is applied CLIENT-side on this full owned set.
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export type FlagSummary = Awaited<ReturnType<typeof trpcClient.flags.list.query>>[number]

export const flagsQueryOptions = queryOptions({
  queryKey: ['flags'],
  queryFn: () => trpcClient.flags.list.query(),
})

export const reviewFlag = (flagId: string, reviewed: boolean) =>
  trpcClient.flags.review.mutate({ flagId, reviewed })

export type CreateFlagInput = Parameters<typeof trpcClient.flags.create.mutate>[0]

/** flags.create — the child-scoped write. Chat guardrail flags are persisted
 * SERVER-side by the SSE route now; this remains for the child's own 'reported'
 * flags (the "Report this answer" button). Child-scoped: `childId` must match
 * the authenticated child. */
export const createFlag = (input: CreateFlagInput) => trpcClient.flags.create.mutate(input)
