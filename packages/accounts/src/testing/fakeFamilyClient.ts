// Browser-safe on purpose (no node:crypto) because iwft tests run in the browser.
//
// It fakes BOTH halves of the service, and keeps their credentials as separate
// as the service does (ADR 0078/0079): `signInAs` is a family token and
// authorises saves alone, a parent cookie session is `signIn`/`signUp` and
// authorises identity alone. Neither stands in for the other here either, so a
// test that confuses them fails in the harness rather than in production.
//
// It also runs **the same validators the service runs**: every input goes
// through the contract's own zod schema, and the save quotas are the same
// constants the handlers use. A fake that models only the happy path and the
// typed refusals lets a 33-character name, an untrimmed one, a 300 KB blob and a
// 65th slot all pass in a harness and fail in production - see this package's
// README.
import type { FamilyTokenClaims } from '../claims.ts'
import { DEFAULT_FAMILY_TOKEN_TTL_MS } from '../claims.ts'
import { FamilyClientError } from '../familyClientError.ts'
import {
  addChildInput,
  deleteChildInput,
  mintSessionTokenInput,
  renameChildInput,
} from '../identityContract.ts'
import { saveDeleteInput, saveGetInput, saveListInput, savePutInput } from '../saveContract.ts'
import { MAX_ACCOUNT_BYTES, MAX_ACCOUNT_SLOTS, MAX_SLOT_BYTES } from '../saveLimits.ts'
import type {
  AddChildInput,
  ChildProfileView,
  DeleteAccountOutput,
  DeleteChildInput,
  DeleteChildOutput,
  FamilyIdentityContract,
  IdentityMeOutput,
  ListChildrenOutput,
  MintSessionTokenInput,
  MintSessionTokenOutput,
  RenameChildInput,
  SignInInput,
  SignUpInput,
} from '../identityContract.ts'
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

type StoredParent = {
  id: string
  name: string
  email: string
  password: string
}

type StoredChild = ChildProfileView & { parentId: string }

export type FakeSessionInput = Omit<FamilyTokenClaims, 'iat' | 'exp'>

/** A parent the harness starts with, so a test can sign in without registering. */
export interface FakeParentInput {
  id?: string
  name: string
  email: string
  password: string
}

export interface FakeFamilyClientOpts {
  now?: () => Date
  /** ADR 0057's gate; `signUp` refuses anything else. */
  inviteCode?: string
  parents?: readonly FakeParentInput[]
}

export class FakeFamilyClient implements FamilySaveContract, FamilyIdentityContract {
  private readonly slots = new Map<string, StoredSlot>()
  private readonly parents = new Map<string, StoredParent>()
  private readonly children = new Map<string, StoredChild>()
  private session: FamilyTokenClaims | null = null
  private parentId: string | null = null
  private failure: Error | null = null
  private readonly now: () => Date
  private readonly inviteCode: string
  private nextId = 1

  constructor(opts: FakeFamilyClientOpts = {}) {
    this.now = opts.now ?? (() => new Date())
    this.inviteCode = opts.inviteCode ?? 'dev-insecure-invite'
    for (const parent of opts.parents ?? []) {
      const id = parent.id ?? this.mintId()
      this.parents.set(id, { ...parent, id })
    }
  }

  // --- the family token: the save half's one credential ----------------------

  signInAs(input: FakeSessionInput): void {
    const nowMs = this.now().getTime()
    this.session = { ...input, iat: nowMs, exp: nowMs + DEFAULT_FAMILY_TOKEN_TTL_MS }
  }

  clearTokenSession(): void {
    this.session = null
  }

  activeSession(): FamilyTokenClaims | null {
    return this.session
  }

  /** Pass null to recover. Applies to both halves, as a service outage would. */
  failWith(error: Error | null): void {
    this.failure = error
  }

  get(raw: SaveGetInput): Promise<SaveGetOutput> {
    return this.saveAccount().then((accountId) => {
      const input = parsed(saveGetInput, raw)
      const slot = this.slots.get(slotId(input.appId, accountId, input.slotKey))
      return slot ? { blob: slot.blob, version: slot.version, updatedAt: slot.updatedAt } : null
    })
  }

  put(raw: SavePutInput): Promise<SavePutOutput> {
    return this.saveAccount().then((accountId) => {
      const input = parsed(savePutInput, raw)
      const key = slotId(input.appId, accountId, input.slotKey)
      const sizeBytes = byteLength(input.blob)
      const existing = this.slots.get(key)

      // The handlers' own three checks, in their order, with their messages:
      // a put prices its own overwrite by the difference, and the account
      // ceiling is summed across every appId (ADR 0079 decision 5).
      if (sizeBytes > MAX_SLOT_BYTES) {
        throw validationError(
          `a save slot holds at most ${MAX_SLOT_BYTES} bytes; this one is ${sizeBytes}`,
        )
      }
      const usage = this.usageFor(accountId)
      if (usage.bytes - (existing?.sizeBytes ?? 0) + sizeBytes > MAX_ACCOUNT_BYTES) {
        throw validationError(
          `this account holds at most ${MAX_ACCOUNT_BYTES} bytes of saves across every app`,
        )
      }
      if (existing === undefined && usage.slots >= MAX_ACCOUNT_SLOTS) {
        throw validationError(
          `this account holds at most ${MAX_ACCOUNT_SLOTS} save slots across every app`,
        )
      }

      const version = (existing?.version ?? 0) + 1
      this.slots.set(key, { blob: input.blob, version, sizeBytes, updatedAt: this.now().getTime() })
      return { version }
    })
  }

  list(raw: SaveListInput): Promise<SaveListOutput> {
    return this.saveAccount().then((accountId) => {
      const input = parsed(saveListInput, raw)
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

  delete(raw: SaveDeleteInput): Promise<SaveDeleteOutput> {
    return this.saveAccount().then((accountId) => {
      const input = parsed(saveDeleteInput, raw)
      this.slots.delete(slotId(input.appId, accountId, input.slotKey))
      return {}
    })
  }

  /** Every slot this account owns, across every appId - the account ceiling's scope. */
  private usageFor(accountId: string): { bytes: number; slots: number } {
    let bytes = 0
    let slots = 0
    for (const [key, slot] of this.slots) {
      if (key.split('\x1f')[1] !== accountId) continue
      bytes += slot.sizeBytes
      slots += 1
    }
    return { bytes, slots }
  }

  // --- the parent cookie session: the identity half's one credential ---------

  signUp(input: SignUpInput): Promise<void> {
    return this.reachable().then(() => {
      if (input.inviteCode !== this.inviteCode) {
        // The real image answers 403 with a message and no code, which the
        // client turns into FORBIDDEN (verified over a real socket).
        throw new FamilyClientError('A valid invite code is required to register.', 'FORBIDDEN')
      }
      if (this.findByEmail(input.email) !== null) {
        throw new FamilyClientError(
          'User already exists. Use another email.',
          'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        )
      }
      const id = this.mintId()
      this.parents.set(id, {
        id,
        name: input.name,
        email: input.email,
        password: input.password,
      })
      // Better Auth signs a new user straight in (autoSignIn is its default).
      this.parentId = id
    })
  }

  signIn(input: SignInInput): Promise<void> {
    return this.reachable().then(() => {
      const parent = this.findByEmail(input.email)
      if (parent === null || parent.password !== input.password) {
        throw new FamilyClientError('Invalid email or password', 'INVALID_EMAIL_OR_PASSWORD')
      }
      this.parentId = parent.id
    })
  }

  signOut(): Promise<void> {
    return this.reachable().then(() => {
      this.parentId = null
    })
  }

  /** Null rather than a refusal: this is how hub asks "is anyone signed in?". */
  me(): Promise<IdentityMeOutput> {
    return this.reachable().then(() => {
      const parent = this.parentId === null ? undefined : this.parents.get(this.parentId)
      return parent === undefined
        ? { parent: null }
        : { parent: { id: parent.id, name: parent.name, email: parent.email } }
    })
  }

  listChildren(): Promise<ListChildrenOutput> {
    return this.requireParent().then((parent) =>
      [...this.children.values()]
        .filter((child) => child.parentId === parent.id)
        // The same two keys `listChildProfiles` orders by, so two profiles
        // created in one millisecond are in the same order on both sides.
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        .map(toView),
    )
  }

  addChild(raw: AddChildInput): Promise<ChildProfileView> {
    return this.requireParent().then((parent) => {
      // Parsed, not read: the schema trims, so `' Ada '` must store as `'Ada'`
      // here exactly as it does in Postgres.
      const input = parsed(addChildInput, raw)
      this.requireUsernameFree(parent.id, input.username)
      const child: StoredChild = {
        id: this.mintUuid(),
        parentId: parent.id,
        username: input.username,
        displayName: input.displayName,
        createdAt: this.now().getTime(),
      }
      this.children.set(child.id, child)
      return toView(child)
    })
  }

  renameChild(raw: RenameChildInput): Promise<ChildProfileView> {
    return this.requireParent().then((parent) => {
      const input = parsed(renameChildInput, raw)
      const child = this.ownChild(parent.id, input.id)
      const username = input.username ?? child.username
      this.requireUsernameFree(parent.id, username, child.id)
      const renamed = { ...child, displayName: input.displayName, username }
      this.children.set(child.id, renamed)
      return toView(renamed)
    })
  }

  deleteChild(raw: DeleteChildInput): Promise<DeleteChildOutput> {
    return this.requireParent().then((parent) => {
      const input = parsed(deleteChildInput, raw)
      const child = this.ownChild(parent.id, input.id)
      this.eraseSaves(child.id)
      this.children.delete(child.id)
      return { ok: true as const }
    })
  }

  mintSessionToken(raw: MintSessionTokenInput): Promise<MintSessionTokenOutput> {
    return this.requireParent().then((parent) => {
      const input = parsed(mintSessionTokenInput, raw)
      const claims: FakeSessionInput =
        input.childId === undefined
          ? { sub: parent.id, role: 'parent', name: parent.name }
          : (() => {
              const child = this.ownChild(parent.id, input.childId)
              return {
                sub: child.id,
                role: 'child' as const,
                parentId: parent.id,
                name: child.displayName,
              }
            })()
      const iat = this.now().getTime()
      return {
        token: encodeUnsignedToken({ ...claims, iat, exp: iat + DEFAULT_FAMILY_TOKEN_TTL_MS }),
      }
    })
  }

  deleteAccount(): Promise<DeleteAccountOutput> {
    return this.requireParent().then((parent) => {
      const owned = [...this.children.values()].filter((child) => child.parentId === parent.id)
      // saves.accountId carries no FK, so erasure is explicit on both sides.
      for (const accountId of [parent.id, ...owned.map((child) => child.id)]) {
        this.eraseSaves(accountId)
      }
      for (const child of owned) this.children.delete(child.id)
      this.parents.delete(parent.id)
      this.parentId = null
      return { ok: true as const }
    })
  }

  activeParent(): string | null {
    return this.parentId
  }

  // --- guards ----------------------------------------------------------------

  // Rejects rather than throwing synchronously, so callers can always .catch().
  private reachable(): Promise<void> {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve()
  }

  private saveAccount(): Promise<string> {
    return this.reachable().then(() => {
      if (!this.session) {
        throw new FamilyClientError('no family session - sign in first', 'UNAUTHORIZED')
      }
      return this.session.sub
    })
  }

  private requireParent(): Promise<StoredParent> {
    return this.reachable().then(() => {
      const parent = this.parentId === null ? undefined : this.parents.get(this.parentId)
      if (parent === undefined) {
        throw new FamilyClientError('parent authentication required', 'UNAUTHORIZED')
      }
      return parent
    })
  }

  private ownChild(parentId: string, childId: string): StoredChild {
    const child = this.children.get(childId)
    if (child === undefined) throw new FamilyClientError('no such child profile', 'NOT_FOUND')
    if (child.parentId !== parentId) {
      throw new FamilyClientError('that child profile is not yours', 'FORBIDDEN')
    }
    return child
  }

  // `child_profiles` is unique on (parentId, username): a clash is per household.
  private requireUsernameFree(parentId: string, username: string, exceptId?: string): void {
    const taken = [...this.children.values()].some(
      (child) =>
        child.parentId === parentId && child.username === username && child.id !== exceptId,
    )
    if (taken) throw new FamilyClientError('that username is already taken', 'CONFLICT')
  }

  private eraseSaves(accountId: string): void {
    for (const key of [...this.slots.keys()]) {
      if (key.split('\x1f')[1] === accountId) this.slots.delete(key)
    }
  }

  private findByEmail(email: string): StoredParent | null {
    return [...this.parents.values()].find((parent) => parent.email === email) ?? null
  }

  private mintId(): string {
    return `fake-parent-${this.nextId++}`
  }

  // The rename and mint inputs are `z.uuid()`, so a fake id has to look like one.
  private mintUuid(): string {
    const n = (this.nextId++).toString(16).padStart(12, '0')
    return `00000000-0000-4000-8000-${n}`
  }
}

function toView(child: StoredChild): ChildProfileView {
  return {
    id: child.id,
    username: child.username,
    displayName: child.displayName,
    createdAt: child.createdAt,
  }
}

/**
 * The same `base64url(JSON).signature` shape the service mints, with a
 * placeholder signature: nothing in the browser verifies it, and `node:crypto`
 * cannot run here.
 */
function encodeUnsignedToken(claims: FamilyTokenClaims): string {
  const bytes = new TextEncoder().encode(JSON.stringify(claims))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${payload}.fake-signature`
}

/**
 * The service's parser failures arrive as tRPC's BAD_REQUEST carrying the
 * ZodError's own message - a stringified issue array rather than prose. The fake
 * says the same thing, so a test can see what a parent would be shown.
 */
function parsed<T>(schema: { parse: (value: unknown) => T }, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    throw new FamilyClientError(
      error instanceof Error ? error.message : 'invalid input',
      'BAD_REQUEST',
    )
  }
}

/** backend-kit maps ValidationError to BAD_REQUEST; the taxonomy has no 413. */
function validationError(message: string): FamilyClientError {
  return new FamilyClientError(message, 'BAD_REQUEST')
}

function byteLength(blob: string): number {
  return new TextEncoder().encode(blob).length
}

// \x1f cannot appear in any part, so composite keys never collide.
function slotId(appId: string, accountId: string, slotKey: string): string {
  return `${appId}\x1f${accountId}\x1f${slotKey}`
}
