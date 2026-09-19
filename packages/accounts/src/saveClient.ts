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

export class FamilyClientError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'FamilyClientError'
    this.code = code
  }
}

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
    return unwrap(await fetchImpl(url, { credentials: 'include' }))
  }

  async function mutate(procedure: string, input: unknown): Promise<unknown> {
    return unwrap(
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

async function unwrap(res: Response): Promise<unknown> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = body.error
    const { message, data } =
      typeof error === 'object' && error !== null
        ? (error as { message?: unknown; data?: { code?: unknown } })
        : {}
    throw new FamilyClientError(
      typeof message === 'string' ? message : `family service request failed (${res.status})`,
      typeof data?.code === 'string' ? data.code : 'INTERNAL_SERVER_ERROR',
    )
  }

  if (!res.ok || typeof body !== 'object' || body === null || !('result' in body)) {
    throw new FamilyClientError(
      `family service request failed (${res.status})`,
      'INTERNAL_SERVER_ERROR',
    )
  }

  return (body as { result: { data?: unknown } }).result.data
}
