// Transport pins for two of the three transports that must all serve the
// SAME router: (a) the in-browser-style dispatcher (createDispatcher fed a
// fetch Request), (b) the Vite dev-server middleware (simulatorPlugin).
// (c) createAppServer is pinned in src/server/createAppServer.test.ts.
import http from 'node:http'
import type { AddressInfo } from 'node:net'

import { createTRPCClient, httpLink, TRPCClientError } from '@trpc/client'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import type { Dispatch } from './dispatch.ts'
import { simulatorPlugin } from './simulator/vitePlugin.ts'
import {
  fixtureDispatch,
  freshDrizzleNotesStore,
  type FixtureRouter,
} from './testSupport/fixtureApp.ts'

function clientOverDispatch(dispatch: Dispatch) {
  return createTRPCClient<FixtureRouter>({
    links: [
      httpLink({
        url: 'http://test.local/api/trpc',
        fetch: (url, options) => dispatch(new Request(url, options as RequestInit)),
      }),
    ],
  })
}

async function expectFixtureRoundTrip(client: ReturnType<typeof clientOverDispatch>) {
  const added = await client.addNote.mutate('buy milk')
  expect(added).toEqual({ id: 1, title: 'buy milk' })
  expect(await client.getNote.query(added.id)).toEqual(added)

  // and the error taxonomy crosses the wire
  const missing = client.getNote.query(999).catch((err: unknown) => err)
  const err = await missing
  expect(err).toBeInstanceOf(TRPCClientError)
  expect((err as TRPCClientError<FixtureRouter>).data?.code).toBe('NOT_FOUND')
  expect((err as TRPCClientError<FixtureRouter>).data?.httpStatus).toBe(404)
}

describe('in-browser-style dispatcher (createDispatcher)', () => {
  it('serves the fixture router from a fetch Request', async () => {
    const dispatch = fixtureDispatch(await freshDrizzleNotesStore())

    await expectFixtureRoundTrip(clientOverDispatch(dispatch))
  })
})

describe('Vite dev-server middleware (simulatorPlugin)', () => {
  let vite: ViteDevServer | undefined
  let server: http.Server | undefined

  afterAll(async () => {
    server?.close()
    await vite?.close()
  })

  it('serves the same fixture router over HTTP', async () => {
    vite = await createViteServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [
        simulatorPlugin({
          createDispatch: async () => fixtureDispatch(await freshDrizzleNotesStore()),
        }),
      ],
    })
    server = http.createServer(vite.middlewares)
    await new Promise<void>((resolve) => server?.listen(0, resolve))
    const { port } = server.address() as AddressInfo

    const client = createTRPCClient<FixtureRouter>({
      links: [httpLink({ url: `http://127.0.0.1:${port}/api/trpc` })],
    })
    await expectFixtureRoundTrip(client)
  })
})
