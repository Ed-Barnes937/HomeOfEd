/** Every family-service client failure, carrying the service's own error code. */
export class FamilyClientError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'FamilyClientError'
    this.code = code
  }
}
