// Cross-origin isolation (120fps ticket 02): COOP + COEP on every response
// make the browser expose SharedArrayBuffer, which is what lets the sim tick
// in a worker while the page reads the world live. The same pair is served in
// dev by vite.config.ts and in CT by playwright-ct.config.ts, so every
// environment runs the mode production runs.
//
// COEP blocks any cross-origin subresource that does not opt in (CORP/CORS) —
// silt loads none (audited 2026-08-26: no fonts, no CDN, no external fetches),
// so nothing breaks. An app that later embeds cross-origin content must
// revisit this. ADR 0036 records the decision.
import type { FastifyInstance } from '@hoe/backend-kit/server'

/** Registered via `createAppServer`'s `registerRoutes` hook — the root-scope
 * `onSend` covers every route, however it was mounted. */
export function addCrossOriginIsolation(app: FastifyInstance): void {
  app.addHook('onSend', (_req, reply, _payload, done) => {
    void reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    void reply.header('Cross-Origin-Embedder-Policy', 'require-corp')
    done()
  })
}
