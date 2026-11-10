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
and exported as `DocumentGate` from `@hoe/backend-kit/server`. Three additions,
all recorded in ADR 0093 decision 1:

- The path is percent-decoded and dot segments collapsed before
  classification. A raw socket sending `/shared/..%2Findex.html` or
  `/api/../index.html` otherwise got `index.html` ungated, because static
  normalises the path itself.
- With a gate, the SPA fallback serves `index.html` to document requests only,
  so `/missing.js` is `404` instead of an ungated app shell. Gate off: the
  fallback is unchanged.
- `publicPaths` match whole segments (`/shared` does not match `/sharedx`); a
  prefix ending in `/` matches as written.

`redirectFor` gets the raw `Host` header (port kept), the raw `req.url` and the
raw `Cookie` header or `null`; a test pins all three.
