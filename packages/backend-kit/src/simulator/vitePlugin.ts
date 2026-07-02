// Dev "simulator mode" transport: a Vite dev-server middleware running the
// real router over Node-side PGlite. Node-only — exported via the separate
// '@hoe/backend-kit/simulator' subpath so it never enters a browser bundle.
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Plugin } from 'vite'

import type { Dispatch } from '../dispatch.ts'

async function toFetchRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
  }
  const method = req.method ?? 'GET'
  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, { method, headers })
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Uint8Array)
  }
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }
  return new Request(url, { method, headers, body })
}

async function writeFetchResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(new Uint8Array(await response.arrayBuffer()))
}

/**
 * Mount the app's dispatcher on the Vite dev server. `createDispatch` runs
 * once at server start (creates PGlite, migrates, wires the Store into the
 * context) — restart `pnpm dev` to pick up backend changes.
 */
export function simulatorPlugin(opts: {
  createDispatch: () => Promise<Dispatch>
  /** Mount path of the tRPC API. Default: '/api/trpc'. */
  endpoint?: string
}): Plugin {
  const endpoint = opts.endpoint ?? '/api/trpc'
  return {
    name: 'hoe:backend-simulator',
    async configureServer(server) {
      const dispatch = await opts.createDispatch()
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(endpoint)) {
          next()
          return
        }
        toFetchRequest(req)
          .then(dispatch)
          .then((response) => writeFetchResponse(res, response))
          .catch((err: unknown) => {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(err) }))
          })
      })
    },
  }
}
