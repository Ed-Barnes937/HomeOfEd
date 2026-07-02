import { TRPCError } from '@trpc/server'

/**
 * The domain error taxonomy — the closed set every app uses instead of
 * inventing its own. Handlers throw these; every transport translates them
 * identically because tRPC derives the wire code + HTTP status from
 * `error.code` in all of its adapters:
 *
 * | Domain error      | tRPC code    | HTTP |
 * |-------------------|--------------|------|
 * | ValidationError   | BAD_REQUEST  | 400  |
 * | UnauthorizedError | UNAUTHORIZED | 401  |
 * | ForbiddenError    | FORBIDDEN    | 403  |
 * | NotFoundError     | NOT_FOUND    | 404  |
 * | ConflictError     | CONFLICT     | 409  |
 * | anything else     | INTERNAL_SERVER_ERROR | 500 |
 *
 * Extending TRPCError is the mechanism, not a licence for handlers to reach
 * into transport concerns: handlers may only throw these named classes.
 */
export abstract class DomainError extends TRPCError {}

/** Input failed a domain rule (beyond schema parsing). 400. */
export class ValidationError extends DomainError {
  constructor(message = 'Invalid input') {
    super({ code: 'BAD_REQUEST', message })
  }
}

/** No authenticated user where one is required. 401. */
export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super({ code: 'UNAUTHORIZED', message })
  }
}

/** Authenticated, but not allowed to do this. 403. */
export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super({ code: 'FORBIDDEN', message })
  }
}

/** The addressed resource does not exist. 404. */
export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super({ code: 'NOT_FOUND', message })
  }
}

/** The request conflicts with current state (duplicate, stale write). 409. */
export class ConflictError extends DomainError {
  constructor(message = 'Conflict') {
    super({ code: 'CONFLICT', message })
  }
}
