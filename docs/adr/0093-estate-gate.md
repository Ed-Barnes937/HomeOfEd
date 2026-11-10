# 0093 - the estate gate: every app needs a family session, checked by the server

- **Status:** Proposed (the estate-gate spec awaits Ed; built to its defaults)
- **Date:** 2026-11-10
- **Related:** [ADR 0070](0070-family-service.md) (the family token this
  checks), [ADR 0078](0078-family-identity-auth-boundary.md) (why the token is
  readable by every estate page, and why tests bind a real port),
  [ADR 0057](0057-family-service-legal-gate.md) (the invite gate, unchanged),
  [ADR 0081](0081-hub-account-ui.md) (hub's `/account`, where the gate sends
  people), [ADR 0026](0026-boop-share-links.md) and
  [ADR 0075](0075-armoury-share-links-and-picture.md) (the fragment share links
  decision 6 moves). Covers decisions 1-6 and 10 of
  [the estate-gate spec](../../.scratch/estate-gate/spec.md); 7-9 are ADR 0094.

## Context

The family service made a child's work follow them between devices, but only
when someone happens to sign in at hub first. Every app still opens for anyone,
so on a shared tablet a child plays as nobody and their work stays on that
browser. Ed wants the estate to behave like one product: arrive anywhere, and
if no one is playing yet, pick who is.

Three things constrain where that check can live. Apps are leaf nodes that
never import each other, so it cannot be one app's code. Most apps are SPAs
whose bundle is public, so a check in the bundle runs only after the app has
loaded and can be skipped. And every app already runs through backend-kit's
`createAppServer`, which serves the bundle, so the server is the one place
every app shares that sees the request before the app does.

## Decision

**1. The gate is server-side, in `createAppServer`, and backend-kit stays free
of `@hoe/accounts`.** It takes an optional `documentGate`:

```ts
documentGate?: {
  publicPaths: readonly string[]
  redirectFor: (req: { host: string; url: string; cookie: string | null }) => string | null
}
```

`@hoe/accounts/server` builds one (`familyDocumentGate`) that lets a request
through when its cookie holds a family token `verifyFamilyToken` accepts, for
any role, offline. backend-kit only knows "null passes, a string is where to
send them".

A **document request** is GET or HEAD, not `/api` or under it, not `/health`,
and its path has no file extension other than `.html`. Only document requests
are gated: assets, tRPC and `/health` are not, so a scale-to-zero health check
and a signed-out page's own assets keep working. The gate runs in an
`onRequest` hook, ahead of `@fastify/static`, because static serves `/` and
`/index.html` itself and the SPA fallback never sees them.

Details the spec left implicit, settled while building it:

- **Ambiguous paths are refused, not interpreted.** The gate classifies a path
  and `@fastify/static` resolves it, and two parsers reading one path will
  eventually disagree. The first cut collapsed dot segments with a
  `decodeURIComponent`, while static uses `decodeURI` and treats `a%2Fb` as one
  segment, so `/api/a%2Fb/../../other.html` looked like `/api` to the gate and
  served `other.html` to anyone. Patching that normaliser would only move the
  disagreement. So with a gate on, any request whose path (before `?`) holds
  a dot segment in any encoding, an encoded slash or backslash, a literal
  backslash, anything `decodeURI` rejects, or does not start with `/` is
  answered `400`. Malformed percent-encoding mostly never reaches the gate:
  Fastify's own URL check answers `400` first, as it does with the gate off.
  Browsers never send any of these. What is left is decoded exactly as static
  decodes it (`decodeURI`) and needs no normalising.
- **HTML is default-deny.** The gate records its verdict on each request, and
  an `onSend` hook lets HTML out only for a request it let through as a
  document or public path. HTML means a content type starting `text/html` or
  `application/xhtml+xml`, compared case-insensitively, plus a `304` for a
  path ending `.htm`, `.shtml`, `.xhtml` or `.xht`, since a `304` carries no
  content type. Anything else that is HTML, such as a `.htm` file static
  serves, is put through the gate at that point and refused the same way. This
  is what catches the next parser mismatch nobody has found yet. Other `304`s
  are left alone, because a signed-out `/shared` page revalidates its assets.
  SVG is not HTML here; assets are ungated by design.
- **`/api` is exempt from all of it.** App-owned routes there (Better Auth, SSE,
  tRPC) answer for themselves, HTML or not.
- **With a gate on, the SPA fallback serves `index.html` to document requests
  only.** Otherwise any missing file, `/missing.js`, came back as the app shell
  without passing the gate. A missing asset is now `404`, which is also the
  honest answer. With the gate off the fallback is unchanged.
- **Public paths match whole segments.** `/shared` matches `/shared` and
  `/shared/...` but not `/sharedx`; a prefix written with a trailing slash,
  like fridge's `/b/`, matches as written.
- **A broken gate fails closed and quietly.** If `redirectFor` throws, or
  returns anything but an absolute `http(s)` URL made only of printable ASCII,
  the request is logged and answered a generic `500` with `no-store`; the
  thrown message never reaches the client. The ASCII rule matters because
  `new URL` silently drops CR, LF and tab while the raw string is what becomes
  the `Location` header, which Node would refuse mid-response.

A refusal is `302` with `Location` and `Cache-Control: no-store`. A gated
document that is let through is also `no-store`, including a `304`
revalidation (set in `onSend`, because static writes its own `Cache-Control`
later), so no cache between the visitor and the app can hand a signed-in
response to the next visitor, or a redirect to a signed-in one.

**2. The gate is on exactly when `FAMILY_ACCOUNT_URL` is set.** Each app's
server entrypoint passes `documentGate` only when the variable exists.
Production sets it in each app's `fly.toml` `[env]`, the docker stack in
`compose.yml`. `pnpm dev` is Vite and never runs `createAppServer`, so dev and
`.iwft` are ungated without a flag. Turning an app on or off is one config
line, and rollback is removing it. The entrypoint's one call is
`familyDocumentGateFromEnv`, which resolves the verifying key only when the
gate is on. On Fly that key is the constant committed in `@hoe/accounts`, with
no per-app Fly variable, so rotating it is a code change and a redeploy; see
[ADR 0070](0070-family-service.md)'s 2026-11-10 amendment.

**3. Exempt apps:** hub (it hosts `/account`, so gating it would loop), family
(the service the gate depends on), and sprout and sprout-pipeline (their own
auth, [ADR 0012](0012-sprout-app-owned-auth.md)). espy's Capacitor shell loads
its bundle from the device and never reaches the server, so it is unaffected.

**4. The redirect contract.** The gate sends
`<FAMILY_ACCOUNT_URL>?returnTo=<absolute URL of the request>`. Hub accepts a
`returnTo` only if its origin is in `ESTATE_APPS` in `@hoe/accounts`: exact
production hosts, and localhost dev and compose ports only when hub itself is
on localhost. Anything else is dropped and hub behaves as if none was given,
so the gate cannot be turned into an open redirect. The URL fragment never
reaches the server; the browser carries it to hub across the `302`, and hub
reattaches it on the way back.

**5. Public paths.** Each app may declare prefixes the gate skips. Fragment
share links use `/shared`; fridge's server-backed board share keeps `/b/`.

**6. The shared view never persists.** `/shared#<payload>` opens the shared
item and lets the visitor play with it and change it, but writes nothing to
`localStorage` or the SaveStore. "Keep this" goes to the app root with the same
fragment, which meets the gate. New share links point at `/shared`. Old root
links (`/#g=...`, `/#w=...`) keep working for signed-in visitors; for everyone
else, hub's signed-out screen offers "Open what was shared", linking to
`<returnTo origin>/shared<fragment>`. Hub knows only that a fragment is present,
never any app's payload format.

**10. Switching player happens at hub only.** Apps link to
`accountUrl(returnTo)`; no app grows its own picker.

## Consequences

The estate becomes invite-only in practice, because the invite gate
([ADR 0057](0057-family-service-legal-gate.md)) now stands in front of play,
not only of sync. The family service being down blocks a new device from
playing; a device that already holds a token keeps working for the token's 30
days, because verification is offline.

The gate is a door, not a vault. The bundle's assets are deliberately
ungated, and a token any estate page can read
([ADR 0078](0078-family-identity-auth-boundary.md)) is what it checks. It
decides who is playing; it protects no data, and nothing behind it may assume
otherwise. A deleted profile's token also passes until it expires
(`.scratch/family-first-slice/issues/10-deleted-profile-tokens.md`).

Post-deploy smoke fetches `/` and greps for an asset, which a gated app answers
with a `302`; the smoke has to change before any app sets
`FAMILY_ACCOUNT_URL` (estate-gate ticket 03).

Two things to watch. An extensionless file such as `/.well-known/<name>` is a
document by this rule and would be gated. And sprout's server-rendered
`/terms` and `/privacy` would be gated if sprout, exempt today, ever set
`FAMILY_ACCOUNT_URL`.

The tests bind a real port. The request envelope is the subject here, and
`fastify.inject()` has twice disagreed with the wire in this repo; the
ambiguous-path findings above came from sending raw request lines, which
neither `inject` nor `fetch` can express.
