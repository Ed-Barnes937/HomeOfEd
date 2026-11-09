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
  saveDeleteOutput,
  saveGetOutput,
  saveListOutput,
  savePutOutput,
} from './saveContract.ts'
import { unwrapTrpcResponse } from './trpcEnvelope.ts'

export interface CreateFamilySaveClientOpts {
  /** The family service origin, e.g. `https://family.homeofed.com`. */
  baseUrl: string
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
}

export function createFamilySaveClient(opts: CreateFamilySaveClientOpts): FamilySaveContract {
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
