# 0057 - the family service's legal gate: household pilot now, counsel before anyone else

- Status: proposed
- Date: 2026-09-15

## Context

The family service (fresh minimal identity + central SaveStore, decision sitting
of the [account-infra map](../../.scratch/account-infra-discovery/map.md),
2026-09-10) will hold accounts for children in the owner's household from its
first slice (boop `boop:save`,
[spec](../../.scratch/family-first-slice/spec.md)). Kids' accounts and kids'
data mean COPPA/GDPR-K-shaped obligations attach the moment anyone outside the
household can register.

Sprout already crossed this ground: its ADR-0019
(`apps/sprout/docs/product-legal-adrs.md`) authorised a supervised household
pilot behind an invite code, deferring counsel sign-off until public launch.
That gate is deliberately scoped to sprout and stays there (decision 1 kept the
family service separate from sprout's user table precisely so it does not
inherit sprout's open legal gate). The family service therefore needs its own
gate, recorded in the repo rather than in the owner's head.

The family service's risk surface is materially smaller than sprout's: no
chat, no LLM output, no conversation content - only account identity and
opaque save blobs from the toy apps.

## Decision

The family service launches as a **supervised household pilot**, and a hard
boundary separates that pilot from any wider release:

1. **Parent-owned accounts, child profiles only.** Children get profiles
   (username + display name), never accounts: no child email, no child
   password, no child date of birth. The parent is the only credentialed
   principal in a household and creates, names, and deletes the profiles.
2. **Registration is invite-code-closed from day one.** Sign-up is gated by a
   server-checked `REGISTRATION_INVITE_CODE` (sprout's mechanism, reused):
   required in production, crash on missing, never persisted, never published.
   The pilot cohort is the owner's household only.
3. **The gate to anything wider.** Before any **non-household** account
   exists - publishing the invite code, inviting another family, removing the
   env requirement - all of the following must close, recorded as a follow-up
   ADR: counsel sign-off, real counsel-drafted ToS/Privacy text, and a
   safeguarding review. Opening registration *is* the release this gate
   protects; there is no partial opening.
4. **Content sensitivity tiers.** What the SaveStore holds today - boops,
   silt scenes, espy doodles - is low-sensitivity creative output. Recorded
   child **voice audio** (the `.scratch/boop-recorded-sounds` idea) is a step
   up: it is biometric-adjacent personal data of a child and never lands in
   the SaveStore by default. Storing it is a deliberate, separate decision
   that re-opens this gate's question even inside the household pilot.
5. **Pilot-only shortcuts, named so they can be revoked.** Two v1 conveniences
   are acceptable only because the cohort is one supervised household, and
   must be revisited before item 3 ever opens:
   - **Shared-device profile tokens**: anyone holding a signed-in device can
     pick any child profile ("who's playing") - profiles authenticate nothing.
   - **No email machinery**: password resets are performed by hand by the
     owner; there is no verification or recovery flow.

## Consequences

- The first slice ships to the owner's family pre-counsel; the owner knowingly
  accepts that risk for the smallest available surface (one household, direct
  supervision, no content beyond creative saves).
- `REGISTRATION_INVITE_CODE` joins the family app's required production
  secrets and its go-live runbook.
- Every future feature that widens data sensitivity (voice audio first among
  them) or widens the cohort must cite this ADR and either fit inside it or
  supersede it with a new one.
- Sprout's ADR-0019 is prior art, not a parent: closing or opening either gate
  moves the other not at all.
- Not legal advice; counsel review is the gate, not this document.
