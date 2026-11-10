# 18 - The docker stack can sign in end to end

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 2
Blocked by: 03

Found by ticket 03, by reading code and not yet by running it: a sign-in
through `docker compose up family hub <app>` probably cannot complete. The
gate only exists in `createAppServer`, so the docker stack is the only place
the whole round trip (tickets 05 and 10) can be exercised before production.

Reported causes, to confirm first:

- Hub's `/account` calls family at `localhost:3012`
  (`apps/hub/src/features/account/familyService.ts`), but compose publishes
  family on 8092.
- The family image runs with `NODE_ENV=production`, so its CORS allows only
  `https://homeofed.com` (`apps/family/src/server/cors.ts`).

Do:

- **Reproduce first.** Bring the stack up and show the failure in a real
  browser before changing anything. If sign-in already works, say how and
  close this ticket with no code change.
- Make hub in the docker stack reach family in the docker stack, and family
  accept hub's and the gated apps' compose origins, **without** weakening
  production: the dev origin tier must stay off whenever the service runs on
  Fly. ADR 0078 decisions 4 and 5 and `assertFitForDeployment` are the
  constraints; read them before touching `cors.ts` or `env.ts`. Prefer an
  explicit compose-only setting that production cannot have by accident over
  anything inferred from `NODE_ENV`.
- The compose registration also needs an invite code and family's secrets;
  make `docker compose up family hub boop` work from a clean checkout with
  documented local-only values, never production ones.
- Prove it: register, add a child, pick who is playing, and see the
  `hoe_family_session` cookie on `localhost`. Tests for any changed origin
  rule bind a real port.
- Amend ADR 0078 for whatever origin rule changed. Update the README
  docker-stack section.

You may edit `compose.yml` (branch from ticket 03's branch if it is unmerged).

## Comments

Reproduced in Chromium against `docker compose up family hub boop` before any
change. Three stacked failures, in order:

1. Hub's bundle called `http://localhost:3012` (connection refused); compose
   publishes family on 8092. Confirmed as reported.
2. With family also published on 3012 (a throwaway override), the preflight
   from `http://localhost:8080` got no allow headers. Confirmed, with one
   correction: `NODE_ENV=development` would not have fixed it either, because
   the dev list is the Vite ports (3000, 3012), not compose's.
3. Better Auth refused sign-up from `http://localhost:8080` as
   `INVALID_ORIGIN` (`trustedOrigins` is the identity list).

Not failures: the `Secure` flag (Better Auth derives it from the `http://`
`BETTER_AUTH_URL`, so its session cookie arrives plain), the invite code
(`dev-invite-code` works), and the CSRF hook (hub sends `application/json`).

Fixed by `DOCKER_STACK_ORIGINS=on` in compose only (ADR 0078 decision 6),
refused on Fly by `@hoe/deploy-guard`'s new `localOnly` argument, and by hub's
and boop's `familyUrl` mapping their compose ports to 8092. Proof:
`node scripts/docker-stack-sign-in.mjs`.

Beyond the ticket: boop's `familyUrl` also maps 8088 to 8092, so the save
tier's compose origin is exercised by a real browser rather than only admitted;
the script's last step checks boop's `save.get` answers 200. `@hoe/deploy-guard`
gained the `localOnly` argument rather than family checking the variable
itself, so sprout's `GEO_ENFORCEMENT` can move onto the same rule later.

