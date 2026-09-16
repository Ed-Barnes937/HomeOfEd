# 04 - identity router: Better Auth, invite gate, token minting

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §4.2, §4.3, §4.4 (mint side), §4.5
Blocked by: 01, 03

The identity half of the family service.

- `better-auth` (sprout's version line), Drizzle adapter over the injected
  `DbClient<FamilySchema>`, `emailAndPassword` enabled; `/api/auth/*`
  forwarded through Fastify to `auth.handler()` (sprout precedent).
- Registration closed behind `REGISTRATION_INVITE_CODE`: `hooks.before` on
  `/sign-up/email`, secret required in prod with boot-crash if missing
  (`main.ts` posture; ADR 0057 records this as the legal gate's mechanism).
- Identity tRPC router, authorised by the Better Auth cookie session
  (host-scoped to `family.homeofed.com`, used only by hub's account UI):
  `me`, children CRUD, `mintSessionToken` (parent self or one of their own
  child profiles - mints the Ed25519 family token via `@hoe/accounts`),
  `deleteAccount` (transactional erasure via ticket 03).
- Ownership guards: a parent can only touch their own children; a parent
  cannot mint for another family's child (typed errors).
- CORS: explicit origin allowlist config (`https://homeofed.com`,
  onboarded `https://<app>.homeofed.com`, `http://localhost:<port>` in dev)
  with `Access-Control-Allow-Credentials: true` - config, never `*`.

TDD: handler unit tests over `freshTestDb` - invite-code rejection, children
CRUD ownership, mint-for-foreign-child rejection, erasure. Token internals
are ticket 01's tests; here test the wiring.

## Comments
