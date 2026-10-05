# 05 - Retire the legacy Fly apps still on the bill

**Status:** needs-triage
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
