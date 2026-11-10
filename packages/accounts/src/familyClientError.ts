import { SAVE_ACCOUNT_MISMATCH } from './saveContract.ts'

/** Every family-service client failure, carrying the service's own error code. */
export class FamilyClientError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'FamilyClientError'
    this.code = code
  }
}

/** A save call for a profile other than the one signed in now, refused by the client or the service. */
export class SaveAccountMismatchError extends FamilyClientError {
  constructor() {
    super(SAVE_ACCOUNT_MISMATCH, 'CONFLICT')
    this.name = 'SaveAccountMismatchError'
  }
}
