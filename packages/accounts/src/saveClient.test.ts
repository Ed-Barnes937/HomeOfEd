import { describe, expect, it } from 'vitest'

import { FamilyClientError, createFamilySaveClient } from './saveClient.ts'

type Call = { url: string; init: RequestInit }

function fakeFetch(respond: (call: Call) => Response) {
  const calls: Call[] = []
  const fetchImpl = (url: string, init?: RequestInit) => {
    const call = { url, init: init ?? {} }
    calls.push(call)
    return Promise.resolve(respond(call))
  }
  return { calls, fetchImpl }
}

const ok = (data: unknown) =>
  new Response(JSON.stringify({ result: { data } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('createFamilySaveClient', () => {
  it('sends get as a tRPC GET query with credentials and unwraps the envelope', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      ok({ blob: '{"a":1}', version: 3, updatedAt: 1750000000000 }),
    )
    const client = createFamilySaveClient({
      baseUrl: 'https://family.homeofed.com',
      fetch: fetchImpl,
    })

    const result = await client.get({ appId: 'boop', slotKey: 'boop:save' })
    expect(result).toEqual({ blob: '{"a":1}', version: 3, updatedAt: 1750000000000 })

    const call = calls[0]!
    const url = new URL(call.url)
    expect(url.origin).toBe('https://family.homeofed.com')
    expect(url.pathname).toBe('/api/trpc/save.get')
    expect(JSON.parse(url.searchParams.get('input') ?? '')).toEqual({
      appId: 'boop',
      slotKey: 'boop:save',
    })
    expect(call.init.method ?? 'GET').toBe('GET')
    expect(call.init.credentials).toBe('include')
  })

  it('passes a null get result through', async () => {
    const { fetchImpl } = fakeFetch(() => ok(null))
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()
  })

  it('sends put as a tRPC POST mutation with a JSON body', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ version: 1 }))
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl })

    const result = await client.put({ appId: 'boop', slotKey: 'boop:save', blob: '{"a":1}' })
    expect(result).toEqual({ version: 1 })

    const call = calls[0]!
    expect(new URL(call.url).pathname).toBe('/api/trpc/save.put')
    expect(call.init.method).toBe('POST')
    expect(call.init.credentials).toBe('include')
    expect((call.init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(call.init.body as string)).toEqual({
      appId: 'boop',
      slotKey: 'boop:save',
      blob: '{"a":1}',
    })
  })

  it('lists and deletes through the right procedures', async () => {
    const { calls, fetchImpl } = fakeFetch((call) =>
      call.url.includes('save.list') ? ok([]) : ok({}),
    )
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl })

    expect(await client.list({ appId: 'boop' })).toEqual([])
    await client.delete({ appId: 'boop', slotKey: 'boop:save' })

    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/save.list')
    expect(calls[0]!.init.method ?? 'GET').toBe('GET')
    expect(new URL(calls[1]!.url).pathname).toBe('/api/trpc/save.delete')
    expect(calls[1]!.init.method).toBe('POST')
  })

  it('throws a FamilyClientError carrying the tRPC error code', async () => {
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            error: { message: 'sign in first', code: -32001, data: { code: 'UNAUTHORIZED' } },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    )
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl })

    const err = await client.get({ appId: 'boop', slotKey: 'boop:save' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('UNAUTHORIZED')
    expect((err as FamilyClientError).message).toBe('sign in first')
  })

  it('throws a FamilyClientError for a non-JSON failure (service down)', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('Bad Gateway', { status: 502 }))
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl })

    const err = await client
      .put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('INTERNAL_SERVER_ERROR')
  })

  it('tolerates a trailing slash on baseUrl', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok(null))
    const client = createFamilySaveClient({ baseUrl: 'https://x/', fetch: fetchImpl })
    await client.get({ appId: 'boop', slotKey: 'boop:save' })
    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/save.get')
  })
})
