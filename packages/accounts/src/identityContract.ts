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

export const addChildInput = z.object({
  username: z.string().trim().min(1).max(32),
  displayName: z.string().trim().min(1).max(32),
})

export const renameChildInput = z.object({
  id: z.uuid(),
  displayName: z.string().trim().min(1).max(32),
})

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

export type IdentityMeOutput = z.infer<typeof identityMeOutput>
export type ChildProfileView = z.infer<typeof childProfileView>
export type ListChildrenOutput = z.infer<typeof listChildrenOutput>
export type AddChildInput = z.infer<typeof addChildInput>
export type RenameChildInput = z.infer<typeof renameChildInput>
export type MintSessionTokenInput = z.infer<typeof mintSessionTokenInput>
export type MintSessionTokenOutput = z.infer<typeof mintSessionTokenOutput>
export type DeleteAccountOutput = z.infer<typeof deleteAccountOutput>

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
 * Everything hub's account page can ask of the family service. The first six go
 * to the identity router over tRPC; the last three to Better Auth.
 */
export interface FamilyIdentityContract {
  me(): Promise<IdentityMeOutput>
  listChildren(): Promise<ListChildrenOutput>
  addChild(input: AddChildInput): Promise<ChildProfileView>
  renameChild(input: RenameChildInput): Promise<ChildProfileView>
  mintSessionToken(input: MintSessionTokenInput): Promise<MintSessionTokenOutput>
  deleteAccount(): Promise<DeleteAccountOutput>
  signUp(input: SignUpInput): Promise<void>
  signIn(input: SignInInput): Promise<void>
  signOut(): Promise<void>
}
