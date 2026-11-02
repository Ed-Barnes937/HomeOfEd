# 02 - Decision: is the sprout pilot running, and should sprout be awake?

**Status:** resolved (2026-11-02)
**Type:** grilling
**Map:** ../map.md
**Reported:** 2026-10-05

## The question for Ed

Setting the database aside: **is the household pilot actually in use right
now?** Not "might the kids use it again" - is it being used this month?

sprout is the only app in the estate that deliberately stays warm, and it does
so three times over:

| Machine | Why it is awake | $/mo |
|---|---|---|
| `hoe-sprout` web | `min_machines_running = 1` - "the authed app stays warm" | ~3.32 |
| `hoe-sprout` worker | no HTTP surface, so it never auto-stops; `fly scale count worker=1` | ~3.32 |
| `hoe-sprout-pipeline` | `auto_stop_machines = 'off'`, `min_machines_running = 1` | ~3.32 |

That is **~$10/mo to keep a two-child pilot warm**, on top of the database.
Every other app in the estate scales to zero and the measured saving from doing
so is ~$50/mo
([baseline](../../account-infra-discovery/issues/02-fly-cost-baseline.md)).

## Options

**A. Pilot is live and warmth matters.** Keep as is. A kid waiting ~2s for a
cold start before they can talk to it is a real UX cost, and the pipeline's
cold start lands *inside* a chat request. Worth $10/mo if the thing is used.

**B. Pilot is live but occasional.** Let all three scale to zero
(`min_machines_running = 0` on web, `auto_stop_machines = 'stop'` + `min = 0`
on the pipeline, `fly scale count worker=0` or fold the retention loop into a
scheduled run). Saves ~$10/mo; costs a cold start on first use of a session.
**Check first:** the worker enforces the ADR-0019 retention/purge policy, which
the compliance docs assume is running. A retention worker that only runs when
someone is awake is a compliance change, not a cost tweak - if the worker
sleeps, retention needs a scheduled trigger (see ADR 0014, worker process for
scheduled work).

**C. Pilot is dormant.** Suspend sprout entirely - scale all three to zero and
stop paying for the database's compute too. The strongest version of this is to
take a dump, tear the cluster down, and restore when the pilot resumes; the
gentler version is just scaling machines to zero and keeping the DB.

## Why this is ticket 02 and not an afterthought

If the answer is C, ticket 04's migration may not be worth doing at all - you
would dump and delete, not migrate. **04 should not start until this is
answered.** If the answer is A or B, 04 proceeds as written.

## Comments


## Decision (2026-11-02, Ed)

**Option C, and narrower than the ticket assumed.** Ed: *"sprout is an in-house
demo only currently. Literally just me trying it out in prod. We can take it
down and not risk losing data."*

Not a two-child household pilot - **one operator, zero other users**. The
database bore this out: 33 rows, 7 messages (ticket 01).

Consequences taken:

- Nothing stays warm. `hoe-sprout` web `min_machines_running = 1 -> 0`;
  `hoe-sprout-pipeline` `auto_stop_machines 'off' -> 'stop'` and
  `min_machines_running = 1 -> 0`; `worker` scaled to 0. ~-$8.66/mo.
- The pipeline's cold start now lands inside the first chat request after idle.
  Accepted explicitly: that cost was only worth paying for a pilot in use.
- This also voided ticket 04's premise and the restore-rehearsal gate - see
  [ADR 0072](../../../docs/adr/0072-sprout-owns-its-postgres-and-triggers-are-scopes.md).

Reverse all three when a real household pilot starts.
