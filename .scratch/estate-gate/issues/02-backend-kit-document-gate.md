# 02 - `backend-kit`: `documentGate` option on `createAppServer`

**Status:** ready-for-agent
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
