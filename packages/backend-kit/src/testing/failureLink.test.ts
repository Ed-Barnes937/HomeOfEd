import { createTRPCClient, httpLink, TRPCClientError, type TRPCLink } from '@trpc/client'
import { describe, expect, it } from 'vitest'

import type { FailureRule } from '../failures.ts'
import {
  fixtureDispatch,
  freshDrizzleNotesStore,
  type FixtureRouter,
} from '../testSupport/fixtureApp.ts'
import { failureLink } from './failureLink.ts'

async function makeClient(rules: FailureRule[]) {
  const dispatch = fixtureDispatch(await freshDrizzleNotesStore())
  return createTRPCClient<FixtureRouter>({
    links: [
      failureLink(rules) as TRPCLink<FixtureRouter>,
      httpLink({
        url: 'http://test.local/api/trpc',
        fetch: (url, options) => dispatch(new Request(url, options as RequestInit)),
      }),
    ],
  })
}

describe('failureLink', () => {
  it('passes through procedures no rule matches', async () => {
    const client = await makeClient([{ path: 'getNote', mode: 'error' }])

    expect(await client.addNote.mutate('unaffected')).toEqual({ id: 1, title: 'unaffected' })
  })

  it('error: the matched call fails with a TRPCClientError', async () => {
    const client = await makeClient([{ path: 'getNote', mode: 'error' }])
    await client.addNote.mutate('a note')

    const err = await client.getNote.query(1).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TRPCClientError)
    expect((err as TRPCClientError<FixtureRouter>).message).toContain('getNote')
  })

  it('latency: delays the matched call by ms, then passes through', async () => {
    const client = await makeClient([{ path: 'addNote', mode: 'latency', ms: 120 }])

    const started = Date.now()
    const added = await client.addNote.mutate('slow note')
    const elapsed = Date.now() - started

    expect(added).toEqual({ id: 1, title: 'slow note' })
    expect(elapsed).toBeGreaterThanOrEqual(100) // allow timer slop below 120
  })

  it('network: the matched call fails like a fetch-level network error', async () => {
    const client = await makeClient([{ path: 'getNote', mode: 'network' }])

    const err = await client.getNote.query(1).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TRPCClientError)
    expect((err as TRPCClientError<FixtureRouter>).cause).toBeInstanceOf(TypeError)
    // a network failure never reached the server, so there is no response data
    expect((err as TRPCClientError<FixtureRouter>).data).toBeUndefined()
  })
})
