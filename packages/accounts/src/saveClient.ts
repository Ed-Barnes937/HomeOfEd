// Hand-rolled over tRPC's HTTP conventions because AppRouter lives in
// apps/family and no app may import it, so the zod contract is the type authority.
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
} from './saveContract.ts'
import {
  SAVE_ACCOUNT_MISMATCH,
  saveDeleteOutput,
  saveGetOutput,
  saveListOutput,
  savePutOutput,
} from './saveContract.ts'
import { FamilyClientError, SaveAccountMismatchError } from './familyClientError.ts'
import { readFamilySession } from './readFamilySession.ts'
import { unwrapTrpcResponse } from './trpcEnvelope.ts'

export interface BindSaveClientOpts {
  /** Who the browser is signed in as now; `readFamilySession()` by default. */
  currentAccount?: () => string | null
}

export interface CreateFamilySaveClientOpts extends BindSaveClientOpts {
  /** The family service origin, e.g. `https://family.homeofed.com`. */
  baseUrl: string
  /** The profile the page was opened for: every call is for it alone (ADR 0080). */
  accountId: string
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

export function createFamilySaveClient(opts: CreateFamilySaveClientOpts): FamilySaveContract {
  return bindSaveClient(wireClient(opts), opts.accountId, opts)
}

/** `client` serving `accountId` alone: refused unsent while another profile is signed in, and by the
 *  service through `expectedAccountId`. Either refusal is a `SaveAccountMismatchError`. */
export function bindSaveClient(
  client: FamilySaveContract,
  accountId: string,
  opts: BindSaveClientOpts = {},
): FamilySaveContract {
  const currentAccount = opts.currentAccount ?? (() => readFamilySession()?.sub ?? null)

  async function guarded<T>(call: () => Promise<T>): Promise<T> {
    if (currentAccount() !== accountId) throw new SaveAccountMismatchError()
    try {
      return await call()
    } catch (error) {
      if (
        error instanceof FamilyClientError &&
        error.code === 'CONFLICT' &&
        error.message === SAVE_ACCOUNT_MISMATCH
      ) {
        throw new SaveAccountMismatchError()
      }
      throw error
    }
  }

  return {
    get: (input) => guarded(() => client.get({ ...input, expectedAccountId: accountId })),
    put: (input) => guarded(() => client.put({ ...input, expectedAccountId: accountId })),
    list: (input) => guarded(() => client.list(input)),
    delete: (input) => guarded(() => client.delete({ ...input, expectedAccountId: accountId })),
  }
}

function wireClient(opts: CreateFamilySaveClientOpts): FamilySaveContract {
  const fetchImpl = opts.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init))
  const base = opts.baseUrl.replace(/\/+$/, '')

  async function query(procedure: string, input: unknown): Promise<unknown> {
    const url = `${base}/api/trpc/save.${procedure}?input=${encodeURIComponent(
      JSON.stringify(input),
    )}`
    return unwrapTrpcResponse(await fetchImpl(url, { credentials: 'include' }))
  }

  async function mutate(procedure: string, input: unknown): Promise<unknown> {
    return unwrapTrpcResponse(
      await fetchImpl(`${base}/api/trpc/save.${procedure}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
    )
  }

  return {
    async get(input: SaveGetInput): Promise<SaveGetOutput> {
      return saveGetOutput.parse(await query('get', input))
    },
    async put(input: SavePutInput): Promise<SavePutOutput> {
      return savePutOutput.parse(await mutate('put', input))
    },
    async list(input: SaveListInput): Promise<SaveListOutput> {
      return saveListOutput.parse(await query('list', input))
    },
    async delete(input: SaveDeleteInput): Promise<SaveDeleteOutput> {
      return saveDeleteOutput.parse(await mutate('delete', input))
    },
  }
}
