import { TRPCError } from '@trpc/server'
import { describe, expect, it } from 'vitest'

import { createContext } from './context.ts'
import { createDispatcher } from './dispatch.ts'
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './errors.ts'
import { InMemoryBlobStore } from './blobs.ts'
import { createTRPC } from './trpc.ts'
import { NoopLogger } from './testSupport/noopLogger.ts'

describe('domain error taxonomy', () => {
  const cases = [
    { error: new ValidationError('bad input'), code: 'BAD_REQUEST', httpStatus: 400 },
    { error: new UnauthorizedError(), code: 'UNAUTHORIZED', httpStatus: 401 },
    { error: new ForbiddenError(), code: 'FORBIDDEN', httpStatus: 403 },
    { error: new NotFoundError(), code: 'NOT_FOUND', httpStatus: 404 },
    { error: new ConflictError(), code: 'CONFLICT', httpStatus: 409 },
  ] as const

  it('every domain error is a TRPCError carrying its taxonomy code', () => {
    for (const { error, code } of cases) {
      expect(error).toBeInstanceOf(DomainError)
      expect(error).toBeInstanceOf(TRPCError)
      expect(error.code).toBe(code)
    }
  })

  it('keeps a custom message', () => {
    expect(new NotFoundError('note 7 not found').message).toBe('note 7 not found')
  })

  // The transport-level pin: a handler throws a domain error, the tRPC
  // transport translates it to the taxonomy's wire code + HTTP status.
  it('maps domain error -> tRPC code -> HTTP status at the transport', async () => {
    const t = createTRPC<null>()
    const router = t.router({
      badRequest: t.procedure.query(() => {
        throw new ValidationError('bad input')
      }),
      unauthorized: t.procedure.query(() => {
        throw new UnauthorizedError()
      }),
      forbidden: t.procedure.query(() => {
        throw new ForbiddenError()
      }),
      notFound: t.procedure.query(() => {
        throw new NotFoundError()
      }),
      conflict: t.procedure.query(() => {
        throw new ConflictError()
      }),
      boom: t.procedure.query(() => {
        throw new Error('not a domain error')
      }),
    })
    const dispatch = createDispatcher({
      router,
      createContext: createContext({
        store: null,
        blobs: new InMemoryBlobStore(),
        logger: new NoopLogger(),
      }),
    })

    const wire = [
      { path: 'badRequest', code: 'BAD_REQUEST', httpStatus: 400 },
      { path: 'unauthorized', code: 'UNAUTHORIZED', httpStatus: 401 },
      { path: 'forbidden', code: 'FORBIDDEN', httpStatus: 403 },
      { path: 'notFound', code: 'NOT_FOUND', httpStatus: 404 },
      { path: 'conflict', code: 'CONFLICT', httpStatus: 409 },
      // anything else stays an opaque 500 — the taxonomy is a closed set
      { path: 'boom', code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
    ] as const

    for (const { path, code, httpStatus } of wire) {
      const response = await dispatch(new Request(`http://test.local/api/trpc/${path}`))
      expect(response.status).toBe(httpStatus)
      const body = (await response.json()) as {
        error: { data: { code: string; httpStatus: number } }
      }
      expect(body.error.data.code).toBe(code)
      expect(body.error.data.httpStatus).toBe(httpStatus)
    }
  })
})
