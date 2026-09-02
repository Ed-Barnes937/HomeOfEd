# 14 — Registration: residence attestation + ToS consent

**What to build:** A parent registering must tick two separate checkboxes — a UK
residence attestation and ToS/Privacy agreement — before the account is created; the
server, not the form, is the control, rejecting any unattested/unagreed signup and
stamping both timestamps with server time. (ADR-0014; ADR-0015 items 5–6; spec
"Registration".)

**Blocked by:** 12 — ToS & Privacy draft documents (the consent checkbox links to
`/terms` and `/privacy`).

**Status:** ready-for-human

- [x] One committed drizzle-kit migration adds `uk_residence_attested_at timestamptz NOT
      NULL` and `tos_agreed_at timestamptz NOT NULL` to the `user` table (`NOT NULL` is
      safe — no deployed accounts exist).
- [x] Both are Better Auth `additionalField`s following the `subscriptionStatus`
      precedent, carried in the signup payload.
- [x] A `databaseHooks.user.create.before` hook rejects any signup lacking a true
      residence attestation **or** ToS agreement, and stamps both columns with
      **server** time (client-supplied timestamps ignored).
- [x] The registration page gains two separate required checkboxes with the proposed,
      counsel-flagged copy — *"I confirm I live in the United Kingdom"* and *"I agree to
      the Terms of Service and have read the Privacy Policy"* (both phrases linking to
      the pages). Do not reword the copy.
- [x] Unit tests over the sprout auth factory's signup API: unattested rejected,
      unagreed rejected, successful signup has both columns server-stamped.
- [x] A whole-frontend test proves submit is blocked until both checkboxes are ticked.
- [x] Verify loop green.

## Comments

**2026-08-25 (agent):** Implemented. Migration `0001_lovely_garia.sql`; additionalFields +
before-create hook in `server/auth/betterAuth.ts` (payload timestamps carried but ignored —
the hook stamps `new Date()` server-side); checkboxes in `ParentRegisterPage.tsx` with the
counsel-flagged copy verbatim, submit disabled until both ticked. The `NOT NULL` columns
required updating every test seed that inserts `user` rows directly (7 `.iwft` files,
store/worker/chat-sse tests, fake store). Status → ready-for-human for counsel-copy sign-off.
