# 18 — Invite-code registration gate (family pilot)

**What to build:** Registration requires a server-checked invite code so the supervised
family pilot (ADR-0019) is genuinely closed: with `REGISTRATION_INVITE_CODE` set, any
signup whose payload lacks the matching code is rejected server-side; the registration
form gains a required invite-code field. The env var is required in production for the
pilot's duration.

**Blocked by:** None — user-approved 2026-08-26 (deferral of counsel sign-off to a
recorded supervised family pilot; see ADR-0019).

**Status:** resolved

- [x] `createSproutAuth` gains an `inviteCode` option; when set, a better-auth
      API-level before-hook on `/sign-up/email` rejects any signup whose body does not
      carry the matching `inviteCode`. The code is never persisted (no column, no
      additionalField).
- [x] When the option is unset (dev/simulator/tests), behaviour is unchanged — open
      registration, existing tests stay green.
- [x] `main.ts` passes `REGISTRATION_INVITE_CODE` and refuses to boot in production
      without it (the PIPELINE_API_KEY pattern), so the pilot cannot silently open.
- [x] The registration form gains a required "Invite code" field; `parentAuth.signUp`
      carries it in the payload. The field is UX; the server hook is the control.
- [x] Unit tests over the auth factory: missing code rejected, wrong code rejected,
      correct code accepted, no gate when the option is unset.
- [x] `go-live.md` step 3 lists the new secret; ADR-0019 records the pilot decision;
      `launch-readiness.md` gains the pilot carve-out note (counsel boxes untouched).
- [x] Verify loop green.

## Comments

**2026-08-26 (agent):** Implemented TDD (red→green on the three gate tests). One
non-obvious fact: an API-level `hooks.before` rejection propagates as a *thrown*
`APIError` through server-side `auth.api.signUpEmail` calls — only the real HTTP path
(`auth.handler`) converts it to a 4xx response, so the gate tests drive the handler
directly (which is also the prod path). Rejection status is 403. Only `main.ts`
constructs the auth with a code — dev/simulator/`.iwft` stay open. ADR-0019 records the
pilot; the launch-readiness gate is annotated, no counsel box ticked.
