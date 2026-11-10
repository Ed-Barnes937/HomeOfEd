# 19 - Apps know the family public key, in production and in the docker stack

**Status:** resolved
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

2026-11-10 (implementer): built everything except the key value, which is
still outstanding. `PRODUCTION_FAMILY_PUBLIC_KEY` in
`packages/accounts/src/familyVerifyingKey.ts` is `null`. To commit it, Ed runs

    openssl pkey -in <private-key.pem> -pubout

and replaces that line with the three output lines joined by `\n` as one string:

    export const PRODUCTION_FAMILY_PUBLIC_KEY: string | null =
      '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA<rest of line 2>\n-----END PUBLIC KEY-----\n'

The existing test then checks it is an Ed25519 public key the gate accepts and
not the test key. No `fly.toml` may set `FAMILY_ACCOUNT_URL` before this lands.

Differences from the ticket:

- With no override and no committed constant, `familyVerifyingKey` throws
  everywhere (not only on Fly), naming both remedies. Apps call it only inside
  their `FAMILY_ACCOUNT_URL` branch (README, "Wiring the gate in an app"), so an
  app with the gate off boots as before; a gated app on Fly with no key, or the
  test key, refuses to boot.
- The test key and the compose-local key are one key (compose's family signs
  with the `@hoe/accounts/testing` private key), so one SPKI comparison refuses
  both. The compose drift test pins that they stay the same key.
- `@hoe/accounts` now depends on `@hoe/deploy-guard` for `isDeployed`. A gated
  app's Dockerfile must ship `packages/accounts` with `src/testing` and
  `packages/deploy-guard`; noted in the README for tickets 10-15.
- `familyVerifyingKey(env, productionKey?)`: the second parameter defaults to
  the constant and exists so both states are tested now.
