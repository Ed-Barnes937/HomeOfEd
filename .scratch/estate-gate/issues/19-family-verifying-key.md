# 19 - Apps know the family public key, in production and in the docker stack

**Status:** needs-info
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 1; ADR 0070 ("the public half ships
as ordinary config inside `@hoe/accounts`")
Blocked by: 01, 18 (and Ed supplying the production public key)

The gate verifies tokens offline, but nothing in the repo holds the production
public key: family has only `FAMILY_TOKEN_PRIVATE_KEY` as a Fly secret, and
`@hoe/accounts` commits only the test pair. `familyDocumentGate` (ticket 01)
takes a required `publicKeyPem`. The docker stack's family signs with a
compose-local key, so a built-in production key alone would leave the stack
looping between an app and hub.

- A committed constant in `@hoe/accounts` for the production public key (the
  value comes from Ed; a public key is safe to commit).
- `familyVerifyingKey(env)` in `@hoe/accounts/server`: returns
  `FAMILY_TOKEN_PUBLIC_KEY` from the environment when set, otherwise the
  production constant. On Fly (`FLY_APP_NAME` set) it throws if the result is
  the committed test public key or the compose-local one, in the manner of
  family's `assertFitForDeployment` and `@hoe/deploy-guard`: a published key
  on Fly would let anyone mint a token that passes the gate.
- `compose.yml`: `FAMILY_TOKEN_PUBLIC_KEY` on the 8 estate services, matching
  the private key compose's family signs with.
- Unit tests for each branch and the refusal; a README note; amend ADR 0070.
- App tickets (10-16) then wire `publicKeyPem: familyVerifyingKey(process.env)`.

Until Ed supplies the key, everything except the constant's value can be built.

## Comments
