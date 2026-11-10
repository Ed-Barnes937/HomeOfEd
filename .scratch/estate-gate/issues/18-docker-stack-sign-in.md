# 18 - The docker stack can sign in end to end

**Status:** ready-for-agent
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
