// children.topics.* — parent-seeded "inspire me" topics (replaces the source
// `api/parent-seeded-topics.ts` + `queries/parent-seeded-topics.ts`).
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export type ParentSeededTopic = Awaited<
  ReturnType<typeof trpcClient.children.topics.list.query>
>[number]

export function topicsQueryOptions(childId: string) {
  return queryOptions({
    queryKey: ['topics', childId],
    queryFn: () => trpcClient.children.topics.list.query({ childId }),
  })
}

export const addTopic = (childId: string, topic: string) =>
  trpcClient.children.topics.add.mutate({ childId, topic })

export const removeTopic = (childId: string, topicId: string) =>
  trpcClient.children.topics.remove.mutate({ childId, topicId })
