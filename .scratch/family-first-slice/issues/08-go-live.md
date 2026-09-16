# 08 - go-live: human-gated infra, pilot begins

**Status:** ready-for-human
**Type:** task (HITL - infrastructure is human-gated per root CLAUDE.md)
**Spec:** [../spec.md](../spec.md) §9 (human-gated steps)
Blocked by: 04, 05, 06, 07

Everything below is Ed-run; the agent's job is the checklist/wizard and the
post-flip smoke verification. Pre-req: **ADR 0057 accepted** (the household
pilot this go-live starts is exactly what that gate authorises).

1. `fly apps create hoe-family` (org personal, lhr).
2. `fly postgres attach` - logical `family` DB in the shared `hoe-pg`
   cluster (`DATABASE_URL` secret lands via attach).
3. `fly secrets set` x3: `BETTER_AUTH_SECRET`, `FAMILY_TOKEN_PRIVATE_KEY`
   (Ed25519 private key; public half already in `packages/accounts` config),
   `REGISTRATION_INVITE_CODE` (never published; required-in-prod boot check
   already enforces it).
4. Cloudflare: proxied CNAME `family -> hoe-family.fly.dev`, Full (strict)
   TLS, Fly cert (flycast/cert gotchas recorded in the sprout migration
   notes).
5. Set the `FAMILY_GO_LIVE` repo variable; first deploy runs the
   `release_command` migration. Watch for the known Fly release-machine
   flake - retry later rather than debugging the app.
6. Smoke: register with invite code, add a child profile, pick who's
   playing, save a boop on one device, load it on another. Household pilot
   begins.

Offer the `/wizard` skill for steps 1-5. Record what was done + any facts
later work depends on (key locations, URLs) in the Answer.

## Comments
