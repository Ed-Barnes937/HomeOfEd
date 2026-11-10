import { describe, expect, it } from 'vitest'

import { FamilyClientError } from './familyClientError.ts'
import { createFamilyIdentityClient } from './identityClient.ts'

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

const trpcError = (status: number, message: string, code: string) =>
  new Response(JSON.stringify({ error: { message, code: -32001, data: { code } } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const client = (fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) =>
  createFamilyIdentityClient({ baseUrl: 'https://family.homeofed.com', fetch: fetchImpl })

const CHILD = {
  id: '11111111-2222-4333-8444-555555555555',
  username: 'robin',
  displayName: 'Robin',
  createdAt: 1750000000000,
}

describe('the identity router half', () => {
  it('reads me as a tRPC GET query with credentials', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ parent: null }))

    expect(await client(fetchImpl).me()).toEqual({ parent: null })

    const url = new URL(calls[0]!.url)
    expect(url.origin).toBe('https://family.homeofed.com')
    expect(url.pathname).toBe('/api/trpc/identity.me')
    expect(calls[0]!.init.method ?? 'GET').toBe('GET')
    expect(calls[0]!.init.credentials).toBe('include')
  })

  it('lists children through identity.children.list', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok([CHILD]))

    expect(await client(fetchImpl).listChildren()).toEqual([CHILD])
    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/identity.children.list')
  })

  it('adds a child as a POST carrying content-type: application/json', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok(CHILD))

    await client(fetchImpl).addChild({ username: 'robin', displayName: 'Robin' })

    const call = calls[0]!
    expect(new URL(call.url).pathname).toBe('/api/trpc/identity.children.add')
    expect(call.init.method).toBe('POST')
    expect(call.init.credentials).toBe('include')
    expect((call.init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(call.init.body as string)).toEqual({
      username: 'robin',
      displayName: 'Robin',
    })
  })

  it('renames a child through identity.children.rename', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ ...CHILD, displayName: 'Bobbin' }))

    const renamed = await client(fetchImpl).renameChild({ id: CHILD.id, displayName: 'Bobbin' })

    expect(renamed.displayName).toBe('Bobbin')
    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/identity.children.rename')
    expect(calls[0]!.init.method).toBe('POST')
  })

  it('sends a new username with a rename when one is given', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ ...CHILD, username: 'bobbin' }))

    await client(fetchImpl).renameChild({ id: CHILD.id, displayName: 'Robin', username: 'bobbin' })

    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      id: CHILD.id,
      displayName: 'Robin',
      username: 'bobbin',
    })
  })

  it('deletes a child as a POST to identity.children.delete', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ ok: true }))

    expect(await client(fetchImpl).deleteChild({ id: CHILD.id })).toEqual({ ok: true })

    const call = calls[0]!
    expect(new URL(call.url).pathname).toBe('/api/trpc/identity.children.delete')
    expect(call.init.method).toBe('POST')
    expect((call.init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(call.init.body as string)).toEqual({ id: CHILD.id })
  })

  it('mints a token for a child, and for the parent when no childId is given', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ token: 'payload.signature' }))
    const subject = client(fetchImpl)

    expect(await subject.mintSessionToken({ childId: CHILD.id })).toEqual({
      token: 'payload.signature',
    })
    await subject.mintSessionToken({})

    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/identity.mintSessionToken')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ childId: CHILD.id })
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({})
  })

  // Without `{ confirm: true }` the procedure's parser refuses: ADR 0078's
  // defence in depth behind the content-type hook.
  it('sends confirm: true with deleteAccount', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ ok: true }))

    expect(await client(fetchImpl).deleteAccount()).toEqual({ ok: true })

    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/identity.deleteAccount')
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ confirm: true })
  })

  it('surfaces a taken username as a typed CONFLICT', async () => {
    const { fetchImpl } = fakeFetch(() =>
      trpcError(409, 'that username is already taken', 'CONFLICT'),
    )

    const err = await client(fetchImpl)
      .addChild({ username: 'robin', displayName: 'Robin' })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('CONFLICT')
    expect((err as FamilyClientError).message).toBe('that username is already taken')
  })

  it('surfaces an anonymous request as UNAUTHORIZED', async () => {
    const { fetchImpl } = fakeFetch(() =>
      trpcError(401, 'parent authentication required', 'UNAUTHORIZED'),
    )

    const err = await client(fetchImpl).listChildren().catch((e: unknown) => e)
    expect((err as FamilyClientError).code).toBe('UNAUTHORIZED')
  })

  it('rejects a reply that does not match the contract', async () => {
    const { fetchImpl } = fakeFetch(() => ok({ parent: { id: 'p1' } }))
    await expect(client(fetchImpl).me()).rejects.toThrow()
  })
})

describe('the Better Auth half', () => {
  const accepted = () =>
    new Response(JSON.stringify({ user: { id: 'p1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  it('registers through /api/auth/sign-up/email with the invite code', async () => {
    const { calls, fetchImpl } = fakeFetch(accepted)

    await client(fetchImpl).signUp({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      inviteCode: 'let-me-in',
    })

    const call = calls[0]!
    expect(new URL(call.url).pathname).toBe('/api/auth/sign-up/email')
    expect(call.init.method).toBe('POST')
    expect(call.init.credentials).toBe('include')
    expect((call.init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(call.init.body as string)).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'correct-horse-battery',
      inviteCode: 'let-me-in',
    })
  })

  it('signs in and out through their own endpoints', async () => {
    const { calls, fetchImpl } = fakeFetch(accepted)
    const subject = client(fetchImpl)

    await subject.signIn({ email: 'ada@example.com', password: 'correct-horse-battery' })
    await subject.signOut()

    expect(new URL(calls[0]!.url).pathname).toBe('/api/auth/sign-in/email')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      email: 'ada@example.com',
      password: 'correct-horse-battery',
    })
    expect(new URL(calls[1]!.url).pathname).toBe('/api/auth/sign-out')
    expect(calls[1]!.init.method).toBe('POST')
  })

  // Better Auth answers with its own envelope, not tRPC's.
  it('carries a coded Better Auth refusal through as a FamilyClientError', async () => {
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            message: 'Invalid email or password',
            code: 'INVALID_EMAIL_OR_PASSWORD',
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    )

    const err = await client(fetchImpl)
      .signIn({ email: 'a@b.c', password: 'x' })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('INVALID_EMAIL_OR_PASSWORD')
    expect((err as FamilyClientError).message).toBe('Invalid email or password')
  })

  /**
   * The exact body the real image sends for a wrong invite code: an APIError
   * raised in Better Auth's before-hook carries no `code`. Falling back to
   * INTERNAL_SERVER_ERROR here would hide the one sentence that tells a parent
   * what went wrong, because callers read that code as unactionable.
   */
  it('derives a code from the status when a refusal carries only a message', async () => {
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(JSON.stringify({ message: 'A valid invite code is required to register.' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    )

    const err = await client(fetchImpl)
      .signUp({ name: 'Ada', email: 'a@b.c', password: 'x', inviteCode: 'wrong' })
      .catch((e: unknown) => e)

    expect((err as FamilyClientError).code).toBe('FORBIDDEN')
    expect((err as FamilyClientError).message).toBe('A valid invite code is required to register.')
  })

  it('still fails typed when the body is not JSON at all', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('Bad Gateway', { status: 502 }))

    const err = await client(fetchImpl)
      .signIn({ email: 'a@b.c', password: 'x' })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(FamilyClientError)
    expect((err as FamilyClientError).code).toBe('INTERNAL_SERVER_ERROR')
  })

  it('tolerates a trailing slash on baseUrl', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ok({ parent: null }))
    await createFamilyIdentityClient({ baseUrl: 'https://x/', fetch: fetchImpl }).me()
    expect(new URL(calls[0]!.url).pathname).toBe('/api/trpc/identity.me')
  })
})
