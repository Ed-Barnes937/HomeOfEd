import { describe, expect, it } from 'vitest'

import { injectedFailureResponse, matchFailureRule, procedurePaths } from './failures.ts'

const endpoint = '/api/trpc'

describe('procedurePaths', () => {
  it('extracts a single procedure path from a tRPC url', () => {
    expect(procedurePaths('http://localhost:3100/api/trpc/health?batch=1&input=%7B%7D', endpoint)).toEqual([
      'health',
    ])
  })

  it('splits batched procedure paths on commas', () => {
    expect(procedurePaths('http://localhost:3100/api/trpc/health,post.list?batch=1', endpoint)).toEqual([
      'health',
      'post.list',
    ])
  })
})

describe('matchFailureRule', () => {
  const url = 'http://localhost:3100/api/trpc/health?batch=1'

  it('returns the first rule whose path is in the request', () => {
    const rule = matchFailureRule(url, endpoint, [
      { path: 'other', mode: 'network' },
      { path: 'health', mode: 'error' },
    ])
    expect(rule).toEqual({ path: 'health', mode: 'error' })
  })

  it('returns undefined when no rule matches', () => {
    expect(matchFailureRule(url, endpoint, [{ path: 'other', mode: 'error' }])).toBeUndefined()
  })
})

describe('injectedFailureResponse', () => {
  it('shapes a batched tRPC error response', () => {
    const res = injectedFailureResponse('http://localhost:3100/api/trpc/health?batch=1', endpoint)
    expect(res.status).toBe(500)
    const body: unknown = JSON.parse(res.body)
    expect(body).toEqual([
      {
        error: {
          message: 'injected failure: health',
          code: -32603,
          data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: 'health' },
        },
      },
    ])
  })

  it('shapes a non-batched tRPC error response as a single object', () => {
    const res = injectedFailureResponse('http://localhost:3100/api/trpc/health', endpoint)
    const body: unknown = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(false)
  })
})
