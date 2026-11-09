# family

The estate's identity and SaveStore service ([ADR 0070](../../docs/adr/0070-family-service.md)).
One scale-to-zero Fly app that mints the family session token every other app
verifies, and stores each app's saves as opaque blobs.

It deliberately owns no account UI. Those screens are hub's, at
`homeofed.com/account`; the page served here is a placeholder that points there.

## State of the app

This is the ticket 02 skeleton: the shell and every wiring touchpoint, no domain
logic. It is still stateless ([ADR 0008](../../docs/adr/0008-apps-without-a-database.md)),
so `/health` is a shallow liveness check and there is no migration step yet. The
database arrives in ticket 03, the identity router in 04, and the save router
in 05.

The starter's `greeting` route is kept as a smoke so the layered path stays
exercised meanwhile:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=family` | real router, no Store (Vite middleware), port 3010 |
| .iwft | `pnpm --filter family run test` | real router in-browser, no Store |
| docker stack | `docker compose up family` | the real image, host port 8090 |

Ports: dev 3010, CT 3110, compose 8090.

Creating `hoe-family` on Fly, attaching its database and setting secrets are
human-gated and happen in ticket 08. See [`CLAUDE.md`](CLAUDE.md) for layout and
what each remaining ticket adds.
