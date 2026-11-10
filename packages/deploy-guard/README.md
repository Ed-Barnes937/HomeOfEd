# @hoe/deploy-guard

Refuses to let deployed infrastructure boot on a secret this public repo
publishes. Zero runtime dependencies, so a headless service that does not use
`@hoe/backend-kit` can depend on it too. The rule is
[ADR 0078](../../docs/adr/0078-family-identity-auth-boundary.md) decision 4; the
extraction and its consumers are [ADR 0088](../../docs/adr/0088-deploy-guard-package.md).

## Usage

Call it once at boot, from the entrypoint's env loader, before anything uses a
secret:

```ts
import { assertFitForDeployment } from '@hoe/deploy-guard'

assertFitForDeployment(process.env, {
  BETTER_AUTH_SECRET: 32, // name -> minimum length on Fly
  REGISTRATION_INVITE_CODE: 16,
})
```

When `FLY_APP_NAME` is set (Fly injects it into every machine; no local stack
sets it), this throws if any named secret:

- is missing or empty,
- **reads as a placeholder**: contains `dev-`, `insecure`, `change-me` /
  `changeme`, `placeholder` or `example`, or starts with `test` (any case),
- is one of `COMMITTED_DEV_SECRETS`, or
- is shorter than its minimum,

and also if `NODE_ENV` is anything but `production`, or if any name in the
optional third argument, `localOnly`, is set at all (family's
`DOCKER_STACK_ORIGINS`: a switch that exists for `compose.yml` alone). Without
`FLY_APP_NAME` it does nothing, which is what lets `.env.example`, `compose.yml`
and the simulator keep their committed dev values. Errors name the variable,
never its value.

The pattern is the primary rule. `COMMITTED_DEV_SECRETS` is belt and braces: a
list only ever enumerates what somebody remembered. A false positive fails
closed and is fixed by generating a different secret
(`openssl rand -base64 32`).

| Export                                                | Use                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `assertFitForDeployment(env, minLengths, localOnly?)` | the guard above                                                          |
| `isDeployed(env)`                                     | gate an app-specific check (family's committed signing key) the same way |
| `COMMITTED_DEV_SECRETS`                               | for drift tests                                                          |
| `Environment`                                         | `Readonly<Record<string, string \| undefined>>`                          |

## Consumers and their drift tests

Each consumer re-reads the files that commit its secrets (`.env.example`, its
`compose.yml` services) and asserts every value there is refused on Fly. A new
committed secret belongs in that app's test, and in `COMMITTED_DEV_SECRETS` too.

- `apps/family/src/server/env.ts` (+ `env.test.ts`)
- `apps/sprout/src/server/env.ts` (+ `env.test.ts`), for both `main.ts` and `worker.ts`
- `apps/sprout-pipeline/src/env.ts` (+ `env.test.ts`)
- `packages/accounts/src/familyVerifyingKey.ts` (+ its test), which uses only
  `isDeployed` to refuse the committed test public key; its drift test,
  `estateApps.test.ts`, reads the estate services in `compose.yml`.

An app that adds this dependency must also add `--filter=@hoe/deploy-guard` and a
`COPY` of `packages/deploy-guard` to its Dockerfile's runtime stages.

## Testing

`pnpm --filter @hoe/deploy-guard run test`
