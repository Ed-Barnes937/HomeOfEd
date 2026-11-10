# 09 - hub: a rate-limited sign-in says so plainly

**Status:** ready-for-agent
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
