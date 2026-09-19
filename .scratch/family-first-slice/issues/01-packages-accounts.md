# 01 - `packages/accounts`: the shared contract

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) §4.4, §5
Blocked by: none

Build `@hoe/accounts` - the one shared surface (plumbing only, hard rule 2).
PR 1 of the build sequence (spec §11); no app code in this ticket.

- `familyToken.ts` - `mintFamilyToken` / `verifyFamilyToken` with **Ed25519**
  (`node:crypto` sign/verify), `base64url(JSON).base64url(sig)`, 30-day TTL,
  `FamilyTokenClaims` (`sub`, `role`, `parentId?`, `name`, `iat`, `exp`).
  Verification is **total**: malformed, tampered, or expired all return
  `null`, never throw (sprout `childToken.ts` generalised - see spec §4.4 for
  why Ed25519 over shared HMAC; approved at spec review).
- `familyAuthProvider(publicKey)` - reads the `hoe_family_session` cookie,
  verifies, returns `FamilyUser = User & { role, parentId?, name }`; drops
  into any app's `createContext({ auth })` seam (ADR 0008 made real).
- Save-router contract: shared zod input/output schemas + typed client (the
  `@hoe/sprout-shared` precedent; the family app's router will `satisfies`
  the contract type so no app imports `apps/family`).
- `readFamilySession()` - decode-only claims read for display; null when
  absent/expired.
- Fakes (hard rule 5): `FakeFamilyClient` (in-memory SaveStore + identity)
  and `mintTestToken` with a committed **test-only** keypair.
- `README.md` (verify checklist requires it); config/tsconfig per
  `packages/config`.

TDD: token round-trip / tamper / expiry / malformed unit tests; fake behaves
like the contract. Verify: `pnpm lint`, `pnpm typecheck`,
`pnpm --filter @hoe/accounts run test`.

## Comments
