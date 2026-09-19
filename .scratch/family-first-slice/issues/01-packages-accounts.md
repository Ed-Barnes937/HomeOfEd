# 01 - `packages/accounts`: the shared contract

**Status:** ready-for-human
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

- 2026-09-16: **built** on branch `family-first-slice`. Verify loop green
  (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @hoe/accounts run test`:
  30 vitest across 5 files).

  **What landed.** `packages/accounts` with three entry points so node-only
  code stays out of browser bundles: `.` (claim types, cookie name, save
  zod schemas + `FamilySaveContract`, `createFamilySaveClient`,
  `readFamilySession`), `./server` (`mintFamilyToken` / `verifyFamilyToken`
  Ed25519 per spec §4.4, `familyAuthProvider` returning
  `FamilyUser = User & { role, parentId?, name }`), `./testing`
  (`FakeFamilyClient`, committed test-only keypair, `mintTestToken`).
  Verification is total; claim shape is strict (child requires `parentId`,
  parent must not carry one). The typed client is hand-rolled fetch over
  tRPC's stable HTTP conventions (GET query / POST mutation, no transformer),
  parsing every response against the zod contract - the `AppRouter` type may
  not cross the app boundary (hard rule 1), so the contract is the type
  authority; the wire shape is pinned by unit tests and gets its E2E proof
  against the real router in ticket 05. Timestamps travel as epoch ms.
  `FakeFamilyClient` covers LWW versioning, per-account scoping,
  UNAUTHORIZED when signed out, and `failWith` for offline degradation.

  **Two-axis code review** (standards + spec sub-agents): no hard violations,
  no spec deviations. Applied its cleanups (shared `splitToken` / `isExpired`
  helpers, TTL constant deduped into `claims.ts`). Two flagged partials are
  deliberate and now documented in the package README: the fake does not
  enforce the §4.6 guards (they are family-handler config, proven in
  ticket 02's handler tests), and its identity surface is session switching
  only - identity-router flows grow when ticket 06 needs them. One
  stricter-than-spec rule kept: a parent token carrying `parentId` is
  rejected at mint and verify.
