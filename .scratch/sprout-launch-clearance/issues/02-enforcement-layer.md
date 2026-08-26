# Which layer refuses a non-UK request

Type: grilling
Status: resolved
Blocked by: 01 (resolved)

## Question

ADR-0008 measure 1 says "edge geo-IP block (Fly.io / Cloudflare) — refuse non-UK requests
before the app". It does not say where. Decide.

The candidates, with the trade-off that actually matters:

- **Cloudflare WAF custom rule.** Truly at the edge, zero application code, no request ever
  reaches Fly. But it lives in the Cloudflare dashboard — **human-gated infra**, invisible to
  the repo, untestable in CI or the docker stack, and silently absent on any environment that
  isn't production.
- **App-level Fastify `onRequest` hook** reading the country header. Versioned in the repo,
  unit-testable over `createAppServer` the way `chat-sse.ts` is, works in the docker stack. But
  it is not "before the app" in ADR-0008's literal sense, and it trusts a header.
- **Both** — WAF as the outer layer, the hook as the enforced-in-code layer that also documents
  the boundary and covers non-Cloudflare paths.

Points to resolve:

- Which layer is the one the legal posture *rests* on, and which is belt-and-braces? ADR-0008's
  standard is "reasonable measures", not perfect — that permits a pragmatic answer.
- Does the pipeline app (`hoe-sprout-pipeline`) need anything? It has no public IP and stays on
  the private `.flycast` network, so probably not — confirm and record.
- Is the boundary all-paths, or are there exempt paths? `/health` is the obvious one; consider
  also `/api/auth/*` and the SSE route.
- If any part lands at Cloudflare, it becomes a step `docs/go-live.md` must carry, and a
  human must apply it. Note that consequence explicitly.
- **CI smoke tests hit `https://hoe-<app>.fly.dev/health` directly** (US runners, no
  Cloudflare — see the [research answer](01-country-blocking-primitives.md), item 3). Edge
  enforcement leaves them working *because* they bypass the edge; app-level enforcement breaks
  them unless `/health` is exempt. Decide whether the smoke URLs staying on `.fly.dev` is a
  recorded constraint or an accident to fix.
- **Free-plan trade found by the research:** an edge block can't show our own page (unbranded
  Cloudflare 1020 only — custom responses are Pro+), which pulls against the edge-only shape
  if the refused-visitor experience (ticket 04) is to say anything at all.

**Recommendation to react to:** the app-level hook is the layer the posture rests on — it is
testable, versioned, and reviewable, which is what makes it defensible — with a Cloudflare WAF
rule added as an outer cheap filter, documented in `go-live.md` but not load-bearing.

## Answer

Resolved 2026-07-29 by `/grilling` (six decisions, one per branch). Recorded as
**ADR-0011 — "UK-only enforcement layers"** in
[`apps/sprout/docs/product-legal-adrs.md`](../../../apps/sprout/docs/product-legal-adrs.md)
(a new ADR, not an ADR-0008 amendment — keeps the accepted, counsel-facing record untouched;
ADR-0011 is flagged for counsel review alongside it). The decisions:

1. **Both layers; the app-level Fastify `onRequest` hook is load-bearing.** Versioned,
   reviewed, unit-testable over `createAppServer` (the `chat-sse.test.ts` pattern) — that is
   what makes it defensible under ADR-0008's reasonable-measures standard. The WAF rule is
   belt-and-braces, never the thing the posture rests on.
2. **Exempt paths: `/health` only.** `/api/auth/*` and `POST /api/chat/stream` are
   explicitly enforced — a non-UK parent must not be able to register or sign in.
3. **The Cloudflare WAF country rule ships ON from launch**, matching ADR-0008's literal
   "edge geo-IP block" text (Ed ruled the path of least deviation from the accepted ADR).
   Accepted consequence: edge-blocked visitors see the unbranded 1020; the app's own refused
   response covers only what bypasses the edge.
4. **CI smoke staying on `.fly.dev` is a recorded constraint** (ADR-0011 item 4 + a
   `deploy.yml` comment at build time): exempt paths only, deliberately independent of
   Cloudflare — a through-Cloudflare smoke would be 403'd from US runners.
5. **No Transform-Rule shared secret at launch.** The `.fly.dev` header-spoofing residual is
   an accepted reasonable-measures risk (more deliberate than the VPN bypass ADR-0008 already
   accepts); the hardening step is named in the ADR for later. Depends on ticket 03 going
   fail-closed for header-less non-exempt requests — revisit if it doesn't.
6. **`hoe-sprout-pipeline` needs nothing** — confirmed from its `fly.toml` and `go-live.md`:
   no public service or IPs, `.flycast`/6PN only. No geo boundary applies.

**Handed onward:** ticket 03 now owns the GB / non-GB / sentinel / missing-header matrix
(this decision assumes fail-closed on missing); ticket 04's page is a hook-rendered
self-contained response (the SPA shell is behind the boundary) seen only by edge-bypassing
traffic; go-live gains two human Cloudflare steps (create the WAF rule — sentinel handling to
match ticket 03 — and verify IP Geolocation, ticket 11).
