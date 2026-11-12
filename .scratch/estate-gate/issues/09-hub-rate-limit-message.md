# 09 - hub: a rate-limited sign-in says so plainly

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 13
Blocked by: 06

Better Auth rate-limits its own endpoints and today its raw refusal text
reaches the form.

- Map the rate-limit refusal in `features/account/accountError.ts` to "Too
  many tries. Wait a minute and try again."
- Disable the submit button for the retry period when the reply carries one,
  otherwise for 60 seconds. No countdown.
- Confirm the real refusal's status, code and headers against
  `docker compose up family` before writing the mapping (five stand-ins have
  already diverged from Better Auth in this codebase), then make
  `FakeFamilyClient` able to produce it.
- Unit test for the mapping, one iwft for the form.

Touches `SignedOutCard` and `accountError` only.

## Comments

- 2026-11-10 (implementer): checked against `docker compose up family hub` from
  hub's page first. Sign-in and sign-up each let three tries through in ten
  seconds, then `429 {"message":"Too many requests. Please try again later."}`,
  `content-type: text/plain;charset=UTF-8`, no `code`, `x-retry-after: 10`.
  Deviations:
  - **The pause is always 60 seconds.** The reply does carry a retry period, but
    family's CORS exposes no headers, so hub's page reads `x-retry-after` as
    null. Honouring it needs family to send `Access-Control-Expose-Headers` and
    the client to carry it on `FamilyClientError`; left out as outside this
    ticket.
  - **Touched beyond `SignedOutCard` and `accountError`:** `FakeFamilyClient`
    now enforces Better Auth's limit itself (as the ticket asked), with a test,
    a client test pinning the real 429, the accounts README, the account POM,
    and an amendment to ADR 0081.
