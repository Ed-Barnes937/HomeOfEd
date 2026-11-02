# 05 - Retire the legacy Fly apps still on the bill

**Status:** resolved (2026-11-02) - child-safe-llm retired, malleable-pls kept
**Type:** task
**Blocked by:** 01
**Map:** ../map.md

## Why

The [Fly cost baseline](../../account-infra-discovery/issues/02-fly-cost-baseline.md)
noted these as "same org, not HomeOfEd, but on the same bill" - ~$4.70/mo - and
then correctly left them alone, because the ticket's scope was HomeOfEd. With
the bill now the actual subject, they are worth a decision:

| App | State at 2026-09-06 | Note |
|---|---|---|
| `child-safe-llm-db` | 1x 256MB **started** + 1GB volume | sprout's pre-migration database |
| `child-safe-llm-pipeline` | 0 machines | sprout-pipeline's predecessor |
| `child-safe-llm-web` | 0 machines | sprout's predecessor |
| `malleable-pls-db` | 1x 256MB **started** + 1GB volume | unrelated project |
| `malleable-pls-server` | 1x 512MB stopped + 1GB volume | unrelated project |

The `child-safe-llm-*` trio is the app sprout was migrated *from*. sprout has
been live at sprout.homeofed.com since 2026-08-27 with chat verified
end-to-end, so its predecessor is almost certainly dead weight - a 256MB
Postgres node that has been running since the migration with nothing talking to
it.

`malleable-pls-*` is a different project entirely and is **Ed's call alone** -
listed here only because it is on the same invoice.

## What to do

1. Confirm current state (ticket 01 re-checks these as part of the inventory).
2. For `child-safe-llm-db`: take a `pg_dump` to local/offsite storage **before**
   destroying anything. It holds the pre-migration copy of the kids' data; even
   if superseded, deleting the only historical copy on a cost ticket would be a
   poor trade. Keep the dump, then destroy the app and its volume.
3. Destroy `child-safe-llm-pipeline` / `-web` (0 machines - near-free, but they
   are clutter and their presence invites confusion with the live apps).
4. Leave `malleable-pls-*` alone unless Ed says otherwise.

**Human-gated**: `fly apps destroy` and volume deletion are Ed's to run. An
agent may draft the exact command sequence and verify state read-only.

## Expected saving

~$2.17/mo for `child-safe-llm-db`, ~$2.50/mo more if the `malleable-pls-*` pair
also goes.

## Comments


## Resolution (2026-11-02)

### Retired: the `child-safe-llm` trio

Verified dead before deleting: `child-safe-llm-web` had 0 machines, 0 secrets
and no IPs; `child-safe-llm-pipeline` had 0 machines and a `DATABASE_URL` that
was **staged and never deployed**; `child-safe-llm-db` was a 256MB node running
since 13 April with nothing in front of it. All three destroyed. **-$2.72/mo**
($2.57 machine + $0.15 volume).

Deviation from step 2: **no `pg_dump` was taken.** This ticket called for one
before destroying, on the grounds it held the pre-migration copy of the kids'
data. Ed waived it, consistent with ticket 02 - sprout has only ever held his
own demo data, so there was no historical copy of anyone's real data to lose.
Recorded as a deliberate deviation, not an oversight.

### Kept: `malleable-pls-*` is live, not legacy

This ticket's instinct ("Leave `malleable-pls-*` alone unless Ed says
otherwise") was right, and the reason is stronger than "unrelated project" -
**the pair is serving traffic**:

```
poc-6afb768d.vercel.app          (static frontend, Vercel)
  -> https://malleable-pls-server.fly.dev   (baked into bundle index-DN7YTUpc.js)
       -> malleable-pls-db                  (database malleable_pls_server, 9.1 MB,
                                             scoped user pls_app)
```

`malleable-pls-server` has `DATABASE_URL` deployed and runs
`auto_stop_machines = "stop"` / `min_machines_running = 0`, which is **why it
shows as `suspended`** in `fly apps list`. It auto-stops; it is not abandoned.
Destroying `malleable-pls-db` would break the live POC.

**Correction to this ticket's Expected saving:** the "~$2.50/mo more if the
`malleable-pls-*` pair also goes" line should not be read as available. It is
not on the table.

The honest saving there is different: `malleable-pls-db` is an always-on 256MB
Postgres holding 9.1 MB behind a zero-user POC whose API already auto-stops.
Letting the **database** auto-stop too is worth ~$2.57/mo and breaks nothing.
Left as a follow-up; it belongs to `malleable-pls-poc`, a separate repo, and
consolidating it into `hoe-pg` was rejected - coupling an external project to
the app hub's shared cluster is not worth $2.72/mo.
