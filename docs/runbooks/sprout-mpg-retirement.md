# Retiring sprout's Managed Postgres - cutting the Fly bill

Takes the Fly bill from **~$62.59/mo to ~$16.11/mo** by moving sprout off
Managed Postgres (MPG) onto its own unmanaged cluster, deleting a dead legacy
stack, and dropping sprout to a demo-sized footprint.

These commands **create and mutate real infrastructure - a human runs them,
never an agent** (root `CLAUDE.md`). Prerequisites: `flyctl` logged in
(`fly auth whoami`), repo checked out, `pnpm install` done.

> **Read this first.** Step 5 destroys a database. It is safe *only* because
> sprout is an in-house demo: `Sprout-db` holds **33 rows** (1 user, 4
> children, 4 conversations, 7 messages) and all schema is reproducible from
> committed Drizzle migrations. If that is no longer true when you run this,
> **stop** and take a dump first.

## Values

| Thing | Value |
| --- | --- |
| MPG cluster (destroyed) | `nlkxjo5wmn4oy93v` (name `sprout`, plan Basic) |
| MPG database | `Sprout-db` |
| New cluster | `sprout-pg` (`lhr`, unmanaged, single node) |
| sprout's database | `sprout` |
| App | `hoe-sprout` (process groups `web` + `worker`) |
| Pipeline app | `hoe-sprout-pipeline` (**stateless** - no DB rewiring) |
| Deleted | `child-safe-llm-web`, `child-safe-llm-pipeline`, `child-safe-llm-db` |
| **Do NOT touch** | `malleable-pls-db`, `malleable-pls-server` |

## Why a second cluster rather than a database in `hoe-pg`

Both work. `hoe-pg` would be free; `sprout-pg` costs ~$2.72/mo and buys an
independent failure domain, restore granularity and upgrade schedule. sprout is
the app slated to hold family data ([ADR 0057](../adr/0057-family-service-legal-gate.md)),
so it is the one worth isolating. See the cost note in
`.scratch/sprout-cost/`.

MPG Basic ($38/mo) is the *cheapest* managed tier - Starter is $72, a middle
tier, not an entry one. There is no "smaller MPG" option.

---

## S0 - Pre-flight

```bash
fly auth whoami
fly apps list
fly mpg list --org personal        # expect: sprout / basic / hoe-sprout
fly mpg status nlkxjo5wmn4oy93v    # note "Total Used Storage"
```

Confirm `malleable-pls-server` is still the live POC's API before you delete
anything near it:

```bash
curl -s https://poc-6afb768d.vercel.app/ -o /dev/null -w '%{http_code}\n'
fly secrets list -a malleable-pls-server   # DATABASE_URL must be Deployed
```

## S1 - Delete the dead `child-safe-llm` stack

sprout's predecessor. `child-safe-llm-web` has no machines, no secrets and no
IPs; `child-safe-llm-pipeline` has no machines and a `DATABASE_URL` that was
staged and never deployed; `child-safe-llm-db` is a 256MB Postgres machine
running since April with nothing in front of it.

Optional look before you delete:

```bash
fly postgres db list -a child-safe-llm-db
```

```bash
fly apps destroy child-safe-llm-web child-safe-llm-pipeline
fly apps destroy child-safe-llm-db
```

Saves **~$2.72/mo** ($2.57 machine + $0.15 volume). Independent of everything
below - you can stop here and still be better off.

## S2 - Create `sprout-pg`

```bash
fly postgres create \
  --name sprout-pg \
  --region lhr \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --vm-memory 512 \
  --volume-size 1 \
  --enable-backups
```

**`--vm-memory 512` is required, not optional.** `--vm-size shared-cpu-1x`
alone provisions 256MB and Fly refuses backups below 512MB:

> Error: Backups require at least 512MB of memory. Please use a larger VM size
> or disable backups.

If flyctl objects to combining `--vm-size` with `--vm-memory`, use the
component flags instead: `--vm-cpu-kind shared --vm-cpus 1 --vm-memory 512`.

The extra 256MB costs **$1.76/mo** in `lhr`, taking `sprout-pg` to $4.48/mo.
Worth it: `--enable-backups` provisions a Tigris bucket for WAL-based backups,
which is what closes the gap that justified MPG in the first place, and 512MB
gives Postgres real headroom rather than the 256MB `hoe-pg` scrapes by on.

> **Cheaper alternative:** drop `--enable-backups` and stay at 256MB /
> $2.72/mo. Defensible today - sprout holds 33 rows of regenerable demo data,
> so backups protect nothing. But sprout is the app slated to hold family data
> ([ADR 0057](../adr/0057-family-service-legal-gate.md)), and adding backups
> later means another round of human-gated infra work. Paying $1.76/mo now
> avoids that.

`--volume-size 1` is deliberate - the real database is 8.5 MB.

## S3 - Point sprout at it

```bash
fly postgres attach sprout-pg --app hoe-sprout --database-name sprout
```

This creates the database, creates a scoped user, and overwrites
`DATABASE_URL` on `hoe-sprout` in one step, using the private
`sprout-pg.flycast` host.

> **If attach refuses because `DATABASE_URL` already exists**, detach MPG
> first and retry. Detach only removes the attachment record, not the secret:
> ```bash
> fly mpg detach nlkxjo5wmn4oy93v --app hoe-sprout
> ```

## S4 - Deploy, migrate, verify

The migrations run via `release_command` in `apps/sprout/fly.toml`, which fires
on **deploy** - a secret change alone is not guaranteed to run it. Deploy
explicitly, from the repo root:

```bash
fly deploy -c apps/sprout/fly.toml
```

Verify, in order:

```bash
# 1. Deep health - a real Store round-trip to the new database
curl -s https://sprout.homeofed.com/health

# 2. Schema actually landed
fly postgres db list -a sprout-pg

# 3. App boots clean
fly logs -a hoe-sprout --no-tail | tail -30
```

Then log in at `sprout.homeofed.com` and send one message. The database is
empty by design, so **expect to re-register** - your old login is not carried
over. Re-create the child profiles you need for demos.

**Do not proceed to S5 until `/health` is green and you have logged in.**

## S5 - Destroy the MPG cluster

Point of no return. This is where the $38.74/mo goes.

```bash
fly mpg detach nlkxjo5wmn4oy93v --app hoe-sprout   # if not already done in S3
fly mpg destroy nlkxjo5wmn4oy93v
```

Saves **$39.58/mo** ($38.74 compute + $0.84 storage).

## S6 - Drop sprout to a demo footprint

sprout is a solo demo, so nothing needs to stay warm. Cold starts are fine.

Edit `apps/sprout/fly.toml`:

```toml
[http_service]
  min_machines_running = 0        # was 1
```

Edit `apps/sprout-pipeline/fly.toml`:

```toml
[[services]]
  auto_stop_machines = 'stop'     # was 'off'
  min_machines_running = 0        # was 1
```

Deploy both, then stop the `worker` group. **`min_machines_running` governs
the `web` group only** - it is an `http_service` setting, and `worker` has no
HTTP surface, so it never auto-stops and must be scaled out of band:

```bash
fly deploy -c apps/sprout/fly.toml
fly deploy -c apps/sprout-pipeline/fly.toml
fly scale count worker=0 --app hoe-sprout
```

> **Never pass `web=0`.** Scaling a group to 0 *removes* its machine, and
> `auto_start_machines` can only wake a machine that exists - so the site goes
> hard down and no request can revive it. `min_machines_running = 0` alone is
> what you want for `web`: the machine stays, stops when idle, and wakes on
> request. Billing is for running time, not for existing, so keeping `web=1`
> costs nothing extra.
>
> If you already ran `web=0`, recover with:
> ```bash
> fly scale count web=1 --app hoe-sprout
> curl -s https://sprout.homeofed.com/health   # expect {"ok":true}
> ```
> `worker=0` IS correct - it has no HTTP surface, nothing wakes it, and it is
> not needed for a demo.

Saves **~$8.66/mo**. Reverse it when a real pilot starts: set both back to
`1` and run `fly scale count worker=1 web=1 --app hoe-sprout`.

---

## Where you land

| Step | Change | Run-rate |
| --- | ---: | ---: |
| Before | | $62.59 |
| S1 delete `child-safe-llm-*` | -$2.72 | $59.87 |
| S5 destroy MPG | -$39.58 | $20.29 |
| S2 add `sprout-pg` (512MB + backups) | +$4.48 | $24.77 |
| S6 demo footprint | ~-$8.66 | **~$16.11** |

Remaining spend: `hoe-pg` $2.57, `hoe-hub` $4.33, `malleable-pls-db` $2.57,
`sprout-pg` $4.48, wake-ups ~$1.63, volumes/snapshots ~$0.53.
At 256MB without backups it is ~$14.35 instead.

Further optional saving: `malleable-pls-db` is an always-on 256MB Postgres
behind a 0-user POC whose API already auto-stops. Letting the database
auto-stop too saves another ~$2.57.

## Rollback

- **Before S5:** re-attach MPG (`fly mpg attach nlkxjo5wmn4oy93v --app
  hoe-sprout`), redeploy. Nothing is lost.
- **After S5:** the cluster is gone and is not recoverable. Rebuilding means a
  fresh `fly mpg create` and a redeploy - schema returns from migrations, the
  33 demo rows do not.

## Troubleshooting

- **`release_command` fails with "machine not found".** A known Fly
  release-machine flake, not an app bug. Retry the deploy later; do not start
  debugging sprout.
- **`/health` 503 after S4.** `DATABASE_URL` did not take. Check
  `fly secrets list -a hoe-sprout` shows it `Deployed`, then redeploy.
- **Postgres cold-start timeouts after S6.** `sprout-pg` stays always-on in
  this runbook; only the app machines auto-stop. If you later auto-stop the
  database too, expect the first request after idle to fail while it wakes.

## Follow-ups (not infrastructure - an agent can do these)

1. **`apps/sprout/fly.toml`** - HUMAN GO-LIVE NOTE 2 still instructs MPG and
   says explicitly *"do NOT run the standard `fly postgres attach hoe-pg`
   path"*. It is now wrong and must be rewritten for `sprout-pg`.
2. **ADR amendment.** [ADR 0005](../adr/0005-unmanaged-fly-postgres.md)'s
   migration trigger fired on an event ("the child-safe LLM app goes live")
   that had not happened. Restate it as a scope ("real users' data in
   production"), not an event. Tracked as
   `.scratch/sprout-cost/issues/03-restate-the-mpg-trigger-adr.md`.
3. **Cost ticket.** Record the verified October breakdown in
   `.scratch/sprout-cost/issues/01-true-bill-inventory.md` - amounts only, no
   invoice identifiers (that directory is committed to a public repo).
4. **Ticket 05** must be corrected: `malleable-pls-db` is **not** an orphan.
