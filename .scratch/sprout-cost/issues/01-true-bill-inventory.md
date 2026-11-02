# 01 - Establish the true bill: the MPG cluster and what else the baseline missed

**Status:** resolved (2026-11-02)
**Type:** research
**Map:** ../map.md
**Reported:** 2026-10-05, Ed ("my bill last month was over $50")

## Question

The [Fly cost baseline](../../account-infra-discovery/issues/02-fly-cost-baseline.md)
said ~$13.30/mo. The actual invoice is >$50. The known cause is that the
baseline inventoried Fly **apps** and an MPG cluster is not an app - but
"known cause" is a hypothesis until the invoice is read line by line. Nothing
downstream (03's ADR, 04's migration) should be sized off an estimate when the
ground truth is one dashboard away.

**Read-only `fly` commands only; never create or mutate infra.**

## What to establish

**The MPG cluster:**

- `fly mpg list` - does it exist, what is it named, what region.
- Its **plan tier** (Basic $38/mo is the floor; Starter $72, Launch $282) and
  its **provisioned storage GB** at $0.28/GB/mo. A Basic cluster with 20GB
  provisioned is $43.60, not $38 - the storage line is not rounding error.
- Whether HA / replicas are on, and whether that is chargeable here.

**The invoice itself (dashboard - `fly` has no billing read command):**

- Last month's actual invoice, line by line. Reconcile against the baseline's
  resource table. Name every line the baseline did not predict, not just MPG.
- Any credits or discounts in play (the baseline flagged these as unknowable
  from the CLI).

**The rest of the estate, re-checked:**

- Confirm the three always-on app machines are still always-on and still
  512MB (`hoe-hub`, `hoe-sprout` web, `hoe-sprout-pipeline`).
- Confirm `hoe-sprout`'s `worker` machine count - `fly.toml` sets
  `min_machines_running` for the `web` group only; the worker's count was set
  out of band via `fly scale count worker=1` and never re-verified.
- Confirm the legacy apps from the baseline are still running:
  `child-safe-llm-db`, `malleable-pls-db`, `malleable-pls-server` (ticket 05).
- `hoe-pg`'s current volume size and free space - ticket 04 adds a database to
  it, and a 1GB volume may need growing first.
- **Does `fly postgres` still work?** The unmanaged product is deprecated (see
  ticket 04's deprecation note). Confirm the subcommands ticket 04 depends on
  are still present in the installed flyctl - at minimum `fly postgres attach`,
  `fly postgres connect`, and volume/snapshot listing. If any have been removed,
  say so loudly: it changes ticket 04's method, not its verdict.

**One thing to settle explicitly:** which database is sprout actually pointed
at right now? `apps/sprout/fly.toml` and `go-live.md` both mandate MPG, but
the [restore rehearsal ticket](../../hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md)
describes `hoe-pg` as "holding the kids' sprout chat data". Both cannot be
true. Check `DATABASE_URL`'s host on `hoe-sprout` (a `*.flympg.net` host means
MPG; `hoe-pg.flycast` means the shared cluster). **If sprout is on `hoe-pg`
after all, this whole effort changes shape and the MPG cluster is simply an
unused $38/mo to delete** - and the restore rehearsal is more urgent, not less.

## Deliverable

The corrected cost table, appended here as the Answer, and echoed to the map's
money table. Correct the
[Fly cost baseline](../../account-infra-discovery/issues/02-fly-cost-baseline.md)
Answer if anything beyond MPG proves wrong there too.

## Comments


## Answer (2026-11-02)

October 2026 invoice, read line by line. Charges $63.01, credits -$1.10,
**total $61.91**; run-rate ~$62.59 once the one-off credits lapse. Amounts
only here - this directory is committed to a public repo, so no invoice
identifiers or billing-account details.

| Line | Net $/mo | Share |
| --- | ---: | ---: |
| MPG cluster compute | 38.74 | 63% |
| Machines, shared CPU (`lhr`) | 16.39 | 26% |
| Machines, additional RAM (`lhr`) | 5.94 | 10% |
| MPG cluster storage (~5.8 GB metered) | 0.84 | 1% |
| Volumes ~4 GB / snapshots | 0.68 charged, fully credited | 0% |
| Bandwidth, all 20 regions | 0.00 | 0% |
| SSL certs, PAYG plan | 0.00 | 0% |

**MPG all-in: $39.58, 64% of the bill.** The hypothesis held.

**What the estimate got wrong:** the map put "sprout's four pieces at ~$48 of
~$50" - sprout's four pieces *were* $48.24, so that part was right. The error
was the total ($62.59, not ~$50) and therefore the **non-sprout** remainder:
$13.67 actual against ~$2 assumed.

**Machines were the real blind spot.** $22.33/mo, not the ~$9.96 the map
carried, because the map counted sprout's three warm machines and missed that
`hoe-pg`, `child-safe-llm-db` and `malleable-pls-db` are three more always-on
256MB nodes. Derived split (Fly does not itemise per app; the additional-RAM
line corroborates it - three 512MB machines give 0.75 GB continuous against
0.845 GB metered):

| Machine | Size | Est. $/mo |
| --- | --- | ---: |
| `hoe-sprout` web | 512MB | 4.33 |
| `hoe-sprout-pipeline` | 512MB | 4.33 |
| `hoe-hub` | 512MB | 4.33 |
| `hoe-pg` | 256MB | 2.57 |
| `child-safe-llm-db` | 256MB | 2.57 |
| `malleable-pls-db` | 256MB | 2.57 |
| 8 suspended apps waking | - | 1.63 |

**Cluster facts:** plan Basic (the cheapest MPG tier - Starter is $72, a middle
tier, so there was no smaller option). 1 replica. 20 GB allocated, 4.3 GB
metered as used. No HA charge visible.

**The storage was not data.** `Sprout-db` measured **8.5 MB**, all four
databases ~31 MB, zero replication slots. Real row counts: 1 user, 1 account,
4 sessions, 4 children, 4 conversations, **7 messages**, 6 behavioural events,
1 device, 1 flag, 4 presets. So ~4.3 GB was MPG platform overhead (WAL for
PITR, base backups, logs), and $38.74/mo was buying durability for 33 rows.

Method note: `pg_stat_user_tables.n_live_tup` reported 0 for every table
because `ANALYZE` has never run on this database. Row *estimates* from the Fly
dashboard are unreliable here; the counts above are direct `count(*)`.

**Also corrected:** `fly apps list` showed `malleable-pls-server` as
`suspended`, which reads as abandoned. It is not - see ticket 05.
