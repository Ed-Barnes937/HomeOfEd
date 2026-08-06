# 11 — Deploy Silt (human-gated)

**What to build:** Silt live at `silt.homeofed.com`. Infrastructure mutation
is human-gated (root CLAUDE.md): the agent prepares and verifies everything
preparable, then hands the human a precise checklist from the go-live runbook
(`docs/runbooks/phase-4-go-live.md`).

Agent-side: confirm `fly.toml`, CI deploy job, and compose service are
correct and green; confirm the docker-stack build works; write the human
checklist (create `hoe-silt`, Cloudflare proxied CNAME `silt →
hoe-silt.fly.dev`, Full (strict) TLS, Fly cert; first deploy via CI).

Human-side: run the checklist.

Agent-side after: verify `https://silt.homeofed.com` serves the app and
`/health` is green; smoke the core loop in production.

**Blocked by:** 09 — Scene persistence; 10 — Mobile bottom bar and touch
painting

**Status:** claimed

- [ ] Human checklist written and handed over; no infra commands run by the agent
- [ ] CI deploys silt on merge (smoke URL passing)
- [ ] `https://silt.homeofed.com` serves the app; `/health` ok
- [ ] Production smoke: paint → play → save → load works in a real browser
