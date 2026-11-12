# family

The estate's identity and SaveStore service ([ADR 0070](../../docs/adr/0070-family-service.md)).
One scale-to-zero Fly app that mints the family session token every other app
verifies, and stores each app's saves as opaque blobs.

It deliberately owns no account UI. Those screens are hub's, at
`homeofed.com/account`; the page served here is a placeholder that points there.

## State of the app

Tickets 02 to 05: the skeleton, the database layer, and both routers. The
Drizzle schema holds the four stock Better Auth tables plus `child_profiles` and
`saves`, one committed migration journal is applied by the `release_command`,
and `FamilyStore` / `DrizzleFamilyStore` is the whole query surface. `/health` is
a real Postgres round-trip through the Store.

The identity router is authorised by the Better Auth cookie session and offers
`me`, `children.list/add/rename/delete`, `mintSessionToken` and `deleteAccount`.
A parent's session lasts 90 days after they last used it on that device: any
tRPC call carrying the cookie pushes it out, at most once a day.
Registration is closed behind `REGISTRATION_INVITE_CODE`
([ADR 0057](../../docs/adr/0057-family-service-legal-gate.md)), and
`/api/auth/*` is forwarded through Fastify to Better Auth's own handler.

The save router is authorised by the family session token instead, and offers
`save.get/put/list/delete` over opaque blobs keyed `(appId, accountId,
slotKey)`. `accountId` always comes from the verified token and never from
input; `appId` must be an onboarded app; a slot holds at most 256 KiB and an
account 2 MiB across every app. Both guards and both CORS tiers are
[ADR 0079](../../docs/adr/0079-family-save-authorisation.md).

The starter's `greeting` route is kept as a smoke so the layered path stays
exercised meanwhile:

```
HomePage → TanStack Query → tRPC client → router → GreetingHandler → ctx.auth
```

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=family` | real router + PGlite Store (Vite middleware), port 3012; no Better Auth and no token seam, so both routers refuse |
| .iwft | `pnpm --filter family run test` | real router in-browser over PGlite; no Better Auth, no minting |
| docker stack | `docker compose up family` | the real image, host port 8092 - the only mode with Better Auth and a live save |

### Environment

`DATABASE_URL` plus four identity variables, all required: the server crashes at
boot without them. `FAMILY_TOKEN_PRIVATE_KEY` (the one key in the estate that can
mint) and `REGISTRATION_INVITE_CODE` are Fly secrets and are never committed or
logged; `BETTER_AUTH_SECRET` is a secret too, and `BETTER_AUTH_URL` is public
config set in `fly.toml`. See [`.env.example`](.env.example). There is no fifth
variable for verifying tokens: the public half is derived from the private key
at boot, so the two cannot drift.

Ports: dev 3012, CT 3112, compose 8092.

Creating `hoe-family` on Fly, attaching its database and setting secrets are
human-gated and happen in ticket 08. See [`CLAUDE.md`](CLAUDE.md) for layout and
what each remaining ticket adds.
