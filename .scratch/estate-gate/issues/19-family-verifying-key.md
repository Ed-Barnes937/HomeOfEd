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

Differences from the ticket (after review, orchestrator decisions):

- On Fly the committed constant is the only key: `FAMILY_TOKEN_PUBLIC_KEY` is
  local-only there (deploy-guard `localOnly`, like `DOCKER_STACK_ORIGINS`) and
  its presence refuses the boot, so there is no runtime comparison against the
  test key. A `null` constant on Fly refuses the boot, naming the constant. Off
  Fly the variable wins, else the constant, else the boot is refused. Rotation
  is a code change and redeploy.
- Apps call only `familyDocumentGateFromEnv(env, { publicPaths })` (the one
  export; `familyVerifyingKey` is internal). It returns `undefined` without
  `FAMILY_ACCOUNT_URL` (or with it empty) and resolves no key, so an app with
  the gate off boots as before. Tickets 10-16 wire `documentGate:
  familyDocumentGateFromEnv(process.env, { publicPaths: [...] })` and follow the
  README's Dockerfile list. ADR 0093 decision 2 points at it.
- `familyDocumentGate` now accepts exactly one PEM public key block; OpenSSL
  would otherwise skip junk around it or a second block.
- The compose drift test lives in `estateApps.test.ts`, beside the compose port
  check. It requires a public key equal to the public half of family's
  compose signing key.
- `@hoe/accounts` depends on `@hoe/deploy-guard`. No runtime source imports
  `src/testing` (pinned by a test), so gated images drop it.
