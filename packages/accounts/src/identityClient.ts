// Hub's account page talks to the family service browser-direct, so this is the
// identity twin of `saveClient.ts`: hand-rolled over tRPC's HTTP conventions
// because `AppRouter` lives in apps/family and no app may import it.
//
// Every call here is authorised by the **Better Auth cookie session** and never
// by the family session token (ADR 0078 decision 1), which is why nothing in
// this file reads or sends a token. `credentials: 'include'` carries the cookie
// cross-origin; the mutations carry `content-type: application/json` because the
// service refuses anything else on `/api/trpc`, which is what forces the
// preflight its CORS allowlist then governs (ADR 0078 decision 5).
import { FamilyClientError } from './familyClientError.ts'
import type {
  AddChildInput,
  ChildProfileView,
  DeleteAccountOutput,
  FamilyIdentityContract,
  IdentityMeOutput,
  ListChildrenOutput,
  MintSessionTokenInput,
  MintSessionTokenOutput,
  RenameChildInput,
  SignInInput,
  SignUpInput,
} from './identityContract.ts'
import {
  childProfileView,
  deleteAccountOutput,
  identityMeOutput,
  listChildrenOutput,
  mintSessionTokenOutput,
} from './identityContract.ts'
import { unwrapTrpcResponse } from './trpcEnvelope.ts'

export interface CreateFamilyIdentityClientOpts {
  /** The family service origin, e.g. `https://family.homeofed.com`. */
  baseUrl: string
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

export function createFamilyIdentityClient(
  opts: CreateFamilyIdentityClientOpts,
): FamilyIdentityContract {
  const fetchImpl = opts.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init))
  const base = opts.baseUrl.replace(/\/+$/, '')

  function post(url: string, body: unknown): Promise<Response> {
    return fetchImpl(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function query(procedure: string): Promise<unknown> {
    return unwrapTrpcResponse(
      await fetchImpl(`${base}/api/trpc/identity.${procedure}`, { credentials: 'include' }),
    )
  }

  async function mutate(procedure: string, input: unknown): Promise<unknown> {
    return unwrapTrpcResponse(await post(`${base}/api/trpc/identity.${procedure}`, input))
  }

  async function auth(route: string, body: unknown): Promise<void> {
    const res = await post(`${base}/api/auth/${route}`, body)
    if (!res.ok) throw await authFailure(res)
  }

  return {
    async me(): Promise<IdentityMeOutput> {
      return identityMeOutput.parse(await query('me'))
    },
    async listChildren(): Promise<ListChildrenOutput> {
      return listChildrenOutput.parse(await query('children.list'))
    },
    async addChild(input: AddChildInput): Promise<ChildProfileView> {
      return childProfileView.parse(await mutate('children.add', input))
    },
    async renameChild(input: RenameChildInput): Promise<ChildProfileView> {
      return childProfileView.parse(await mutate('children.rename', input))
    },
    async mintSessionToken(input: MintSessionTokenInput): Promise<MintSessionTokenOutput> {
      return mintSessionTokenOutput.parse(await mutate('mintSessionToken', input))
    },
    async deleteAccount(): Promise<DeleteAccountOutput> {
      return deleteAccountOutput.parse(await mutate('deleteAccount', { confirm: true }))
    },
    signUp(input: SignUpInput): Promise<void> {
      return auth('sign-up/email', input)
    },
    signIn(input: SignInInput): Promise<void> {
      return auth('sign-in/email', input)
    },
    signOut(): Promise<void> {
      return auth('sign-out', {})
    },
  }
}

async function authFailure(res: Response): Promise<FamilyClientError> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const { message, code } =
    typeof body === 'object' && body !== null
      ? (body as { message?: unknown; code?: unknown })
      : {}
  return new FamilyClientError(
    typeof message === 'string' ? message : `family service request failed (${res.status})`,
    typeof code === 'string' ? code : 'INTERNAL_SERVER_ERROR',
  )
}
