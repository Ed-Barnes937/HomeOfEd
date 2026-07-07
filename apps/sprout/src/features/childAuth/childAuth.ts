// childAuth.* — the device-login / PIN / password-change surface (replaces the
// source `api/child-auth.ts`). These procedures are PUBLIC (they run before a
// child session exists). On success they return the child profile + a signed
// child-session TOKEN; the caller stores the profile via lib/childSession and
// (P5) the token is set as the httpOnly child-session cookie by the server.
import { queryOptions } from '@tanstack/react-query'

import {
  setChildSession,
  setChildSessionCookie,
  type ChildSession,
} from '../../lib/childSession.ts'
import { trpcClient } from '../../trpcClient.ts'
import { parentAuth } from '../parentAuth/parentAuth.ts'

export type LoginPasswordInput = Parameters<typeof trpcClient.childAuth.loginPassword.mutate>[0]
export type LoginPinInput = Parameters<typeof trpcClient.childAuth.loginPin.mutate>[0]
export type ChangePasswordInput = Parameters<typeof trpcClient.childAuth.changePassword.mutate>[0]
export type LoginResult = Awaited<ReturnType<typeof trpcClient.childAuth.loginPassword.mutate>>

export function deviceChildrenQueryOptions(deviceToken: string) {
  return queryOptions({
    queryKey: ['device-children', deviceToken],
    queryFn: () => trpcClient.childAuth.deviceChildren.query({ deviceToken }),
    retry: false,
  })
}

export const loginWithPassword = (input: LoginPasswordInput) =>
  trpcClient.childAuth.loginPassword.mutate(input)

export const loginWithPin = (input: LoginPinInput) => trpcClient.childAuth.loginPin.mutate(input)

export const changePassword = (input: ChangePasswordInput) =>
  trpcClient.childAuth.changePassword.mutate(input)

/** The side effects establishing a child session touches — injected so the
 * one-identity rule is unit-testable in the node env (no DOM). */
export interface ChildSessionEffects {
  signOutParent: () => Promise<void>
  setCookie: (token: string) => void
  setProfile: (profile: ChildSession) => void
}

const defaultChildSessionEffects: ChildSessionEffects = {
  signOutParent: parentAuth.signOut,
  setCookie: setChildSessionCookie,
  setProfile: setChildSession,
}

/**
 * Establish the child session in this browser. Sprout is ONE IDENTITY PER
 * BROWSER: a co-resident parent Better Auth session would shadow the child on
 * every child-scoped tRPC call — the auth seam gives the parent header
 * precedence over the child cookie — so children.myConfig / conversations.*
 * would 401. Signing the parent out first is what keeps the child usable on a
 * shared/handed-over device. Token is optional: the post-password-change path
 * has already set the cookie from the initial-login token.
 */
export async function establishChildSession(
  profile: ChildSession,
  token: string | undefined,
  effects: ChildSessionEffects = defaultChildSessionEffects,
): Promise<void> {
  await effects.signOutParent()
  if (token) effects.setCookie(token)
  effects.setProfile(profile)
}
