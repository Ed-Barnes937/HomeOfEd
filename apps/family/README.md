# family

The estate's identity and SaveStore service ([ADR 0070](../../docs/adr/0070-family-service.md)).
One scale-to-zero Fly app that mints the family session token every other app
verifies, and stores each app's saves as opaque blobs.

It deliberately owns no account UI. Those screens are hub's, at
`homeofed.com/account`; the page served here is a placeholder that points there.

## State of the app

The ticket 02 skeleton plus ticket 03's database layer: the Drizzle schema (the
four stock Better Auth tables, `child_profiles`, `saves`), one committed
migration journal applied by the `release_command`, and the `FamilyStore`
interface with `DrizzleFamilyStore` behind it. `/health` is a real Postgres
round-trip through the Store. No tRPC procedure reads the store yet - the
identity router arrives in ticket 04 (which also injects the store into the
transports) and the save router in 05.

The starter's `greeting` route is kept as a smoke so the layered path stays
exercised meanwhile:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=family` | real router, no Store yet (Vite middleware), port 3010 |
| .iwft | `pnpm --filter family run test` | real router in-browser, no Store yet |
| docker stack | `docker compose up family` | the real image, host port 8090 |

Ports: dev 3010, CT 3110, compose 8090.

Creating `hoe-family` on Fly, attaching its database and setting secrets are
human-gated and happen in ticket 08. See [`CLAUDE.md`](CLAUDE.md) for layout and
what each remaining ticket adds.
