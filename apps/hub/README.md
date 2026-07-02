# hub

Landing page for `homeofed.com` and the reference app for the "adding an app"
checklist (root `CLAUDE.md`). One route rendering `trpc.health()` — a value
read from Postgres/PGlite through the full layered path:

```
HomePage → TanStack Query → tRPC client → router → HealthHandler → HealthStore → DbClient
```

See [`CLAUDE.md`](CLAUDE.md) for layout, commands, and scoped rules.
