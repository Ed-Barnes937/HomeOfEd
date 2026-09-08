# 07 - Research: cheap deployment landscape for this estate's shape

**Status:** claimed
**Type:** research
**Map:** ../map.md

## Question

Beyond Fly, what would an estate of this shape cost - in money and in ops -
elsewhere? The shape: ~10 dockerised apps, mostly SPAs with small Node/tRPC
backends, a homepage (hub) acting as the gate/launcher, low DB and backend
usage (Postgres, a few logical DBs), a wanted account layer (identity + save
blobs), future monetisation (payments someday), and sprout as the bigger
SaaS-like app (always-on-ish web, private LLM pipeline worker with secret
isolation, stricter kids-data posture).

Survey with real 2026 prices (cite sources):

- **Stay on Fly** (baseline - numbers from tickets 02/06, don't redo).
- **VPS** (Hetzner, DigitalOcean, etc.) + Docker Compose, or a self-hosted
  PaaS (Coolify, Dokploy): monthly price for a machine that fits the estate,
  the ops burden being taken on (OS patching, Postgres backups, TLS, uptime),
  and what happens to the per-app affected-path CI deploys.
- **PaaS per-service** (Render, Railway, DO App Platform): at ~10 services
  does per-service pricing kill these? Say so with numbers, don't hedge.
- **Hybrid**: static-built SPAs on free static hosting (e.g. Cloudflare
  Pages) + only the real backends (hub? wotd/fridge/sprout + account service)
  on Fly or a VPS; note what it does to the single-container-per-app model
  and the tRPC backends the "static" apps still carry.
- Anything genuinely purpose-fit (Cloudflare Workers + D1?) - with the
  Node/Fastify/tRPC/Postgres porting cost stated honestly.

Per option: estimated monthly cost at ~0 and ~100 users, migration effort,
ongoing ops burden, fit with repo constraints (human-gated infra, Docker
per-app images, Postgres, Cloudflare in front), and where sprout's needs
(always-on chat, secret isolation, kids' data in a known jurisdiction) land.

End with a shortlist worth Ed's time and what each would change, if anything,
about tickets 03/04's recommendations. Analysis only - no infra mutation, no
signups.
