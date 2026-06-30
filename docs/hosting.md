# Hosting & Infrastructure

How app-hub and its apps get deployed to production. **Decision reached: Fly.io**
for compute, Cloudflare for DNS/CDN. This doc captures the decision and the
reasoning so it doesn't need re-deriving.

> Decided 2026-06-28.

## The decision

- **Compute: Fly.io**, region **London (LHR)**.
- **DNS + CDN: Cloudflare** (the domain is already registered there), sitting in
  front of Fly as the proxy/CDN layer.
- **One Docker container per app**, deployed to Fly. Backends run as plain
  long-running Node processes.
- **No Kubernetes; Terraform optional/deferred.** Manage apps with `fly.toml`
  committed to git + Cloudflare for DNS. (Reasoning below.)

## Stack context that drove it

- **Frontends:** React, via TanStack Start (full-stack meta-framework, SSR +
  server functions on Nitro). Some apps installable as PWAs (service worker — a
  frontend artifact, no hosting constraint beyond HTTPS + cache headers).
  *(Superseded: the default is now a Vite SPA; TanStack Start is opt-in — see
  [ADR 0003](adr/0003-spa-default-tanstack-start-opt-in.md). Hosting is
  unaffected.)*
- **Backends:** TypeScript, a mix of tRPC and REST. Some apps will likely need
  **WebSockets**; **queues and long-running requests** are expected to be niche.
- **Most technical app:** a child-safe platform for LLM interaction that
  intercepts AI-service responses, runs evals on them, then streams them back to
  the client.

## Why Fly over the alternatives

**The deciding factor was the child-safe LLM app's legal exposure.** It's
subject to more stringent law; due diligence for V1 has only covered **UK law**,
so it must deploy to a **London** region for data residency / a clean compliance
story. (Strict UK law is usually about transfer safeguards rather than physical
location, but keeping data in-region is the simplest defensible choice for V1.)

Secondary reasons that reinforced Fly:

- **WebSockets + streaming need a long-running server, not serverless.** A plain
  Node process does WebSockets, streaming, and normal npm packages with zero
  ceremony. This ruled out the serverless-first options (Cloudflare Workers need
  Durable Objects for WebSockets + a non-Node runtime; Vercel functions can't
  hold WebSockets at all).
- **Docker-per-app** suits local development as well as deploy.
- **Scale-to-zero** via Fly's machine auto-stop/start — a nice-to-have, free.
- Plain Node everywhere, one mental model across apps and backends.

### Railway (runner-up)

Strong on developer experience and **one-click managed databases** (its biggest
edge over Fly), but its EU region is **Amsterdam, not London** — which fails the
residency requirement for the LLM app. Would have been the pick on convenience
grounds alone if not for that.

### AWS (deferred, not dismissed)

Not off the cards for cost or residency — AWS **London (eu-west-2)** exists and
compute can be cheap (the real cost trap is fixed infra: NAT Gateway ~$32/mo,
ALB ~$16–20/mo base). It's deferred for V1 purely on **operational complexity /
time-to-ship** (VPC, IAM, task defs, Terraform/CDK = weeks of work).

**Kept as the graduate-to-it option** for when compliance scope grows (more
regions/regulations beyond UK) or scale demands it. The **Docker-per-app choice
makes that migration cheap** — the same containers run on ECS/Fargate unchanged,
so choosing Fly now is not a lock-in.

## Infra management: no Kubernetes, Terraform deferred

These aren't competing tools — **Terraform provisions** infrastructure (declares
what exists), **Kubernetes orchestrates** containers (runs/schedules/scales
them). The question was only whether either is needed on Fly at this scale.

- **Kubernetes: no.** Fly *is* the orchestrator — scheduling, restarts, scaling,
  auto-stop/start are exactly what k8s would do, and Fly does them already.
  Running k8s on top reinvents that with heavy ops overhead. Kubernetes belongs
  to the AWS graduation path (raw cloud, many services), not V1.
- **Terraform: optional, deferred.** A Fly provider + Cloudflare provider could
  manage apps/DNS/secrets as one source of truth, but `fly.toml` per app in git
  + Cloudflare DNS already gives declarative config for a handful of apps. Adopt
  Terraform later if manual setup gets repetitive or reproducible environments
  are needed — it's incremental, no rework to add.

## Open questions

- ~~**Fly Postgres vs Upstash/Supabase**~~ — **Resolved:** Fly Managed Postgres
  (LHR), one database per app — see [ADR 0001 §6](adr/0001-foundation.md).
- **Streaming design for the LLM eval app** — if an eval needs the *whole*
  response before judging, streaming is lost (buffer then send); if evals run
  per-chunk, it can stream through live. App-design decision, not hosting.
