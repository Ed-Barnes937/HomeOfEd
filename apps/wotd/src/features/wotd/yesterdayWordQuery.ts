import { queryOptions } from '@tanstack/react-query'

import type { Difficulty } from '../../server/wordGenerator.ts'
import { trpcClient } from '../../trpcClient.ts'

export const yesterdayWordQueryOptions = (level: Difficulty) =>
  queryOptions({
    queryKey: ['yesterdayWord', level],
    queryFn: () => trpcClient.yesterdayWord.query(level),
  })
