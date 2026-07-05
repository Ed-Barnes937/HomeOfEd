import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

export const todayWordsQueryOptions = queryOptions({
  queryKey: ['todayWords'],
  queryFn: () => trpcClient.todayWords.query(),
})
