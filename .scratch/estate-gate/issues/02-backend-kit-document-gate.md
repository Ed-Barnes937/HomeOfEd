# 02 - `backend-kit`: `documentGate` option on `createAppServer`

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 1, 2, 5

Add an optional `documentGate` to `CreateAppServerOpts`
(`packages/backend-kit/src/server/createAppServer.ts`):

```ts
documentGate?: {
  publicPaths: readonly string[]
  /** null = let it through; a string = the absolute URL to 302 to. */
  redirectFor: (req: { host: string; url: string; cookie: string | null }) => string | null
}
```

- Runs before `@fastify/static` and the SPA fallback, so `/`, `/index.html`
  and every client-routed path are covered. A document request is defined in
  spec decision 1; `publicPaths` are prefix matches that skip the gate.
- A refused request gets `302`, `Location`, `Cache-Control: no-store`. A
  gated document that is allowed through is also served `no-store`, so no
  cache can hand it to the next visitor.
- Omitted option = today's pipeline, byte for byte. `backend-kit` gains no
  dependency on `@hoe/accounts`.
- Tests bind a real port (README: `fastify.inject()` does not share the HTTP
  parser's semantics). Cover: `/`, `/index.html`, a deep SPA path, an asset,
  `/api/trpc`, `/health`, a public path, HEAD, and a POST.
- ADR 0093 (estate gate: spec decisions 1-6 and 10). Update the package README.

## Comments

**2026-11-10, implementer.** Built as specified; the option shape is unchanged
and exported as `DocumentGate` from `@hoe/backend-kit/server`; the hooks live in
`packages/backend-kit/src/server/documentGate.ts`. Additions, all recorded in
ADR 0093 decision 1:

- Ambiguous paths get `400` before anything else (dot segments in any
  encoding, `%2F`/`%5C`, literal backslash, bad encoding, or a path not
  starting with `/`); the rest is decoded with `decodeURI`, as static does.
  This replaced a first-cut normaliser that review showed disagreed with
  static (`/api/a%2Fb/../../other.html` served HTML ungated).
- HTML is default-deny in `onSend`: a `text/html` or `application/xhtml+xml`
  response (any case), or a `304` for a `.htm`/`.shtml`/`.xhtml`/`.xht` path,
  whose request was not let through as a document or public path is gated
  there (`/api` exempt). Only those 304s, not all: a signed-out `/shared` page
  revalidates its assets, and gating every 304 would break it.
- A throwing `redirectFor`, or one returning anything but an absolute
  `http(s)` URL of printable ASCII (CR/LF, `€`), is logged and answered a
  generic `500` with `no-store`.
- With a gate, the SPA fallback serves `index.html` to document requests only,
  so `/missing.js` is `404` instead of an ungated app shell. Gate off: the
  fallback is unchanged.
- `publicPaths` match whole segments (`/shared` does not match `/sharedx`); a
  prefix ending in `/` matches as written.

`redirectFor` gets the raw `Host` header (port kept), the raw `req.url` and the
raw `Cookie` header or `null`; a test pins all three.
