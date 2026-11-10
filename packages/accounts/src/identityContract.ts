// The wire shapes of the family service's identity router, mirroring
// `apps/family/src/server/handlers/identity/*`. As with the save contract, no
// app may import that router, so these schemas are the type authority and the
// client parses every reply through them.
//
// The sign-in / sign-up / sign-out trio is deliberately absent: those are Better
// Auth's own `/api/auth/*` endpoints, whose request and reply shapes belong to
// Better Auth rather than to us, so they are typed as plain interfaces below.
import { z } from 'zod'

export const identityMeOutput = z.object({
  parent: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
})

export const childProfileView = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  /** Epoch ms, so the wire needs no tRPC transformer. */
  createdAt: z.number(),
})

export const listChildrenOutput = z.array(childProfileView)

const childName = z.string().trim().min(1).max(32)

export const addChildInput = z.object({
  username: childName,
  displayName: childName,
})

export const renameChildInput = z.object({
  id: z.uuid(),
  displayName: childName,
  /** Absent leaves the username as it is. */
  username: childName.optional(),
})

export const deleteChildInput = z.object({ id: z.uuid() })

export const deleteChildOutput = z.object({ ok: z.literal(true) })

export const mintSessionTokenInput = z.object({
  /** Absent means the parent themselves. */
  childId: z.uuid().optional(),
})

export const mintSessionTokenOutput = z.object({ token: z.string().min(1) })

/**
 * `confirm` is the whole point: a mutation with no input parser never reads the
 * request body, which is how a preflight-free POST once erased a household
 * (ADR 0078 decision 5). Erasure fails without it.
 */
export const deleteAccountInput = z.object({ confirm: z.literal(true) })

export const deleteAccountOutput = z.object({ ok: z.literal(true) })

/**
 * When one account of the household last saved in one app, for hub's `/account`
 * page. Metadata for the owning parent only: no blob and nothing parsed from one
 * (ADR 0079).
 */
export const saveSummaryEntry = z.object({
  /** The parent's own `id` from `me`, or a profile `id` from `listChildren`. */
  accountId: z.string(),
  appId: z.string(),
  /** Epoch ms of that account's newest save in that app. */
  updatedAt: z.number(),
})

/** One entry per (account, app) with a save, in `compareSaveSummaryEntries` order. */
export const saveSummaryOutput = z.array(saveSummaryEntry)

/**
 * `accountId` then `appId`, by code unit rather than locale or database
 * collation, so the service and the fake cannot disagree on order.
 */
export function compareSaveSummaryEntries(
  a: Pick<SaveSummaryEntry, 'accountId' | 'appId'>,
  b: Pick<SaveSummaryEntry, 'accountId' | 'appId'>,
): number {
  const byCodeUnit = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0)
  return byCodeUnit(a.accountId, b.accountId) || byCodeUnit(a.appId, b.appId)
}

export type IdentityMeOutput = z.infer<typeof identityMeOutput>
export type ChildProfileView = z.infer<typeof childProfileView>
export type ListChildrenOutput = z.infer<typeof listChildrenOutput>
export type AddChildInput = z.infer<typeof addChildInput>
export type RenameChildInput = z.infer<typeof renameChildInput>
export type DeleteChildInput = z.infer<typeof deleteChildInput>
export type DeleteChildOutput = z.infer<typeof deleteChildOutput>
export type MintSessionTokenInput = z.infer<typeof mintSessionTokenInput>
export type MintSessionTokenOutput = z.infer<typeof mintSessionTokenOutput>
export type DeleteAccountOutput = z.infer<typeof deleteAccountOutput>
export type SaveSummaryEntry = z.infer<typeof saveSummaryEntry>
export type SaveSummaryOutput = z.infer<typeof saveSummaryOutput>

export interface SignUpInput {
  name: string
  email: string
  password: string
  /** ADR 0057's registration gate; the service refuses a sign-up without it. */
  inviteCode: string
}

export interface SignInInput {
  email: string
  password: string
}

/**
 * The identity **router**, and only it. This is the half `apps/family` binds to
 * with `satisfies`, which is what keeps the contract, the real client and the
 * fake from drifting apart - the same guarantee `FamilySaveContract` already
 * gives the save half.
 */
export interface FamilyIdentityRouterContract {
  me(): Promise<IdentityMeOutput>
  listChildren(): Promise<ListChildrenOutput>
  addChild(input: AddChildInput): Promise<ChildProfileView>
  renameChild(input: RenameChildInput): Promise<ChildProfileView>
  deleteChild(input: DeleteChildInput): Promise<DeleteChildOutput>
  mintSessionToken(input: MintSessionTokenInput): Promise<MintSessionTokenOutput>
  deleteAccount(): Promise<DeleteAccountOutput>
  saveSummary(): Promise<SaveSummaryOutput>
}

/**
 * Better Auth's own endpoints. Separate because they are not tRPC procedures, so
 * the family router cannot implement them however the contract is written - and
 * because their shapes are Better Auth's rather than ours, which is also why
 * they carry interfaces and no zod.
 */
export interface FamilyAuthContract {
  signUp(input: SignUpInput): Promise<void>
  signIn(input: SignInInput): Promise<void>
  signOut(): Promise<void>
}

/** Everything hub's account page can ask of the family service. */
export interface FamilyIdentityContract
  extends FamilyIdentityRouterContract,
    FamilyAuthContract {}
