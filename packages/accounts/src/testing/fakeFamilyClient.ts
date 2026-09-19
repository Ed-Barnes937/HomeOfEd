// Browser-safe on purpose (no node:crypto) because iwft tests run in the browser.
import type { FamilyTokenClaims } from '../claims.ts'
import { DEFAULT_FAMILY_TOKEN_TTL_MS } from '../claims.ts'
import { FamilyClientError } from '../saveClient.ts'
import type {
  FamilySaveContract,
  SaveDeleteInput,
  SaveDeleteOutput,
  SaveGetInput,
  SaveGetOutput,
  SaveListInput,
  SaveListOutput,
  SavePutInput,
  SavePutOutput,
} from '../saveContract.ts'

type StoredSlot = {
  blob: string
  version: number
  sizeBytes: number
  updatedAt: number
}

export type FakeSessionInput = Omit<FamilyTokenClaims, 'iat' | 'exp'>

export class FakeFamilyClient implements FamilySaveContract {
  private readonly slots = new Map<string, StoredSlot>()
  private session: FamilyTokenClaims | null = null
  private failure: Error | null = null
  private readonly now: () => Date

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? (() => new Date())
  }

  signInAs(input: FakeSessionInput): void {
    const nowMs = this.now().getTime()
    this.session = { ...input, iat: nowMs, exp: nowMs + DEFAULT_FAMILY_TOKEN_TTL_MS }
  }

  signOut(): void {
    this.session = null
  }

  activeSession(): FamilyTokenClaims | null {
    return this.session
  }

  /** Pass null to recover. */
  failWith(error: Error | null): void {
    this.failure = error
  }

  get(input: SaveGetInput): Promise<SaveGetOutput> {
    return this.ready().then((accountId) => {
      const slot = this.slots.get(slotId(input.appId, accountId, input.slotKey))
      return slot ? { blob: slot.blob, version: slot.version, updatedAt: slot.updatedAt } : null
    })
  }

  put(input: SavePutInput): Promise<SavePutOutput> {
    return this.ready().then((accountId) => {
      const key = slotId(input.appId, accountId, input.slotKey)
      const version = (this.slots.get(key)?.version ?? 0) + 1
      this.slots.set(key, {
        blob: input.blob,
        version,
        sizeBytes: new TextEncoder().encode(input.blob).length,
        updatedAt: this.now().getTime(),
      })
      return { version }
    })
  }

  list(input: SaveListInput): Promise<SaveListOutput> {
    return this.ready().then((accountId) => {
      const prefix = slotId(input.appId, accountId, '')
      return [...this.slots.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, slot]) => ({
          slotKey: key.slice(prefix.length),
          version: slot.version,
          sizeBytes: slot.sizeBytes,
          updatedAt: slot.updatedAt,
        }))
        .sort((a, b) => a.slotKey.localeCompare(b.slotKey))
    })
  }

  delete(input: SaveDeleteInput): Promise<SaveDeleteOutput> {
    return this.ready().then((accountId) => {
      this.slots.delete(slotId(input.appId, accountId, input.slotKey))
      return {}
    })
  }

  // Rejects rather than throwing synchronously, so callers can always .catch().
  private ready(): Promise<string> {
    if (this.failure) return Promise.reject(this.failure)
    if (!this.session)
      return Promise.reject(new FamilyClientError('no family session - sign in first', 'UNAUTHORIZED'))
    return Promise.resolve(this.session.sub)
  }
}

// \x1f cannot appear in any part, so composite keys never collide.
function slotId(appId: string, accountId: string, slotKey: string): string {
  return `${appId}\x1f${accountId}\x1f${slotKey}`
}
