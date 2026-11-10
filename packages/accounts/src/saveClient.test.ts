import { describe, expect, it } from 'vitest'

import { FamilyClientError, SaveAccountMismatchError } from './familyClientError.ts'
import { bindSaveClient, createFamilySaveClient } from './saveClient.ts'
import { SAVE_ACCOUNT_MISMATCH } from './saveContract.ts'
import { FakeFamilyClient } from './testing/fakeFamilyClient.ts'

/** A client bound to child-1 in a browser where child-1 is still signed in. */
const BOUND = { accountId: 'child-1', currentAccount: () => 'child-1' }

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
      ...BOUND,
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
      expectedAccountId: 'child-1',
    })
    expect(call.init.method ?? 'GET').toBe('GET')
    expect(call.init.credentials).toBe('include')
  })

  it('passes a null get result through', async () => {
    const { fetchImpl } = fakeFetch(() => ok(null))
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })
    expect(await client.get({ appId: 'boop', slotKey: 'boop:save' })).toBeNull()
  })

  it('sends put as a tRPC POST mutation with a JSON body', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ version: 1 }))
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })

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
      expectedAccountId: 'child-1',
    })
  })

  it('lists and deletes through the right procedures', async () => {
    const { calls, fetchImpl } = fakeFetch((call) =>
      call.url.includes('save.list') ? ok([]) : ok({}),
    )
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })

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
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })

    const err = await client.get({ appId: 'boop', slotKey: 'boop:save' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('UNAUTHORIZED')
    expect((err as FamilyClientError).message).toBe('sign in first')
  })

  it('throws a FamilyClientError for a non-JSON failure (service down)', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('Bad Gateway', { status: 502 }))
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })

    const err = await client
      .put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('INTERNAL_SERVER_ERROR')
  })

  it('tolerates a trailing slash on baseUrl', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok(null))
    const client = createFamilySaveClient({ baseUrl: 'https://x/', fetch: fetchImpl, ...BOUND })
    await client.get({ appId: 'boop', slotKey: 'boop:save' })
    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/save.get')
  })
})

describe('a client bound to the profile its page was opened for', () => {
  const conflict = () =>
    new Response(
      JSON.stringify({
        error: { message: SAVE_ACCOUNT_MISMATCH, code: -32009, data: { code: 'CONFLICT' } },
      }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    )

  it('sends nothing once the browser is signed in as someone else', async () => {
    let signedIn: string | null = 'child-1'
    const { calls, fetchImpl } = fakeFetch(() => ok(null))
    const client = createFamilySaveClient({
      baseUrl: 'https://x',
      fetch: fetchImpl,
      accountId: 'child-1',
      currentAccount: () => signedIn,
    })

    signedIn = 'child-2'
    const put = client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })
    signedIn = null
    const get = client.get({ appId: 'boop', slotKey: 'boop:save' })

    await expect(put).rejects.toBeInstanceOf(SaveAccountMismatchError)
    await expect(get).rejects.toBeInstanceOf(SaveAccountMismatchError)
    expect(calls).toEqual([])
  })

  it('turns the service’s refusal into a SaveAccountMismatchError', async () => {
    const { fetchImpl } = fakeFetch(conflict)
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })

    const err = await client
      .put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SaveAccountMismatchError)
    expect((err as FamilyClientError).code).toBe('CONFLICT')
  })

  it('binds any client, so a fake stands in for the wire', async () => {
    const fake = new FakeFamilyClient()
    fake.signInAs({ sub: 'child-2', role: 'child', parentId: 'parent-1', name: 'Bo' })
    const client = bindSaveClient(fake, 'child-1', { currentAccount: () => 'child-1' })

    await expect(
      client.put({ appId: 'boop', slotKey: 'boop:save', blob: 'x' }),
    ).rejects.toBeInstanceOf(SaveAccountMismatchError)
    await expect(fake.get({ appId: 'boop', slotKey: 'boop:save' })).resolves.toBeNull()
  })
})

describe('the tRPC envelope', () => {
  it('refuses a batched reply explicitly rather than as a mystery 500', async () => {
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(JSON.stringify([{ result: { data: null } }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = createFamilySaveClient({ baseUrl: 'https://x', fetch: fetchImpl, ...BOUND })

    const err = await client.get({ appId: 'boop', slotKey: 'boop:save' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).message).toContain('batched reply')
  })
})
