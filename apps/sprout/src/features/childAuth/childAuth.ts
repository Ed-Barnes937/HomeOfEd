// childAuth.* — the device-login / PIN / password-change surface (replaces the
// source `api/child-auth.ts`). These procedures are PUBLIC (they run before a
// child session exists). On success they return the child profile + a signed
// child-session TOKEN; the caller stores the profile via lib/childSession and
// (P5) the token is set as the httpOnly child-session cookie by the server.
import { queryOptions } from '@tanstack/react-query'

import { trpcClient } from '../../trpcClient.ts'

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
