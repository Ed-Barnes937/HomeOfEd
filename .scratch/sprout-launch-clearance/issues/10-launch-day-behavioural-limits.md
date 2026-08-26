# Launch-day values for the eight behavioural limits

Type: grilling
Status: closed (2026-08-19)
Assignee: ed-barnes937 (claimed 2026-08-07)
Blocked by: —

## Question

`BEHAVIOURAL_LIMITS` (`apps/sprout/src/server/behavioural-limits.ts`) is already fully
env-var-driven, so this is a **values** decision, not a code change. The roadmap calls the
current numbers "placeholders until tuned against real traffic" — but there is no traffic before
launch, so launch-day values have to be chosen deliberately rather than waiting.

The eight knobs and their in-code defaults:

| Env var | Default |
| --- | --- |
| `RATE_LIMIT_VELOCITY_WINDOW_S` | 60 |
| `RATE_LIMIT_MAX_MESSAGES` | 20 |
| `RATE_LIMIT_PROBE_WINDOW_S` | 300 |
| `RATE_LIMIT_MAX_PROBES` | 4 |
| `RATE_LIMIT_REPUTATION_WINDOW_S` | 3600 |
| `RATE_LIMIT_DEVICE_PROBE_STRIKES` | 8 |
| `RATE_LIMIT_PIN_WINDOW_S` | 900 |
| `RATE_LIMIT_MAX_PIN_FAILURES` | 5 |
| `RATE_LIMIT_RETENTION_S` | 86400 |

Points to resolve:

- **Are the code defaults the launch values?** If yes, this ticket is cheap and the answer is
  "ship the defaults, revisit after N weeks" — a legitimate outcome. If not, which change and why.
- **Which of these are safety limits and which are abuse limits?** `MAX_PROBES` and
  `DEVICE_PROBE_STRIKES` gate a child probing the guardrails; `MAX_PIN_FAILURES` gates a child
  brute-forcing a parent PIN. They have different tolerances for a false positive — a wrongly
  throttled child is a bad experience, a wrongly-allowed PIN brute-force is a breach.
- **20 messages a minute** — is that a realistic ceiling for an enthusiastic 8-year-old, or does
  it throttle normal play? This is the one most likely to produce a false positive at launch.
- **Where are the values set** — `fly.toml` `[env]` (visible, versioned, right for non-secrets)
  or Fly secrets? Note that setting them in `fly.toml` makes them a repo artifact, which is
  reviewable and preferable for tuning knobs.
- **How is a false positive detected after launch?** A throttled child produces a
  `THROTTLE_MESSAGE`, not an alert. Decide whether launch needs any visibility into how often
  each limit fires, or whether that's a later concern. Without it, "tuning against real traffic"
  has no input.

**Recommendation to react to:** ship the code defaults except `RATE_LIMIT_MAX_MESSAGES`, raise
that (60/minute is still clearly non-human sustained), set all nine in `fly.toml` `[env]` so
they're reviewable, and accept no firing-rate visibility at launch as a known gap rather than
building telemetry now.

## Answer

Resolved by grilling, recorded as **ADR-0018** in
[`product-legal-adrs.md`](../../../apps/sprout/docs/product-legal-adrs.md). The table
recommendation was adopted with two departures: `RATE_LIMIT_MAX_MESSAGES` stays at **20**
(not raised to 60 — the false positive is a 60-second gentle pause, an acceptable cost;
60/min only catches scripts), and the "no visibility" framing was overturned by a code
fact — every throttle already writes a `rate_violation` row to `behavioural_events`, so
firing rates are queryable by SQL without building anything.

Point by point:

- **Values:** code defaults for eight of the nine knobs. Probe limits kept strict by
  intent (they back the 6.5.6 safety claim; a session tripping four flags in five minutes
  should pause regardless of intent). PIN lockout arithmetic is sound (half a 4-digit
  space ≈ 3 weeks at 5/15 min); its per-child keying is a sibling-nuisance vector that
  only denies access — accepted.
- **The one change:** `RATE_LIMIT_RETENTION_S` 86400 → **604800** (7 days), so the tuning
  input survives the whole first week. Still inside the worker's 30-day backstop; intent
  to drop back towards 24 h once tuned is recorded. Counsel-flagged (retention of
  children's behavioural metadata).
- **Where set:** all nine pinned explicitly in `fly.toml [env]` (done alongside the ADR —
  no `/tdd` handoff; env values have no unit-testable seam and `numEnv` is already
  covered). Future tunes are one-line reviewable diffs.
- **False-positive detection:** pull-based — the documented SQL query over
  `behavioural_events` grouped by `kind` (in the ADR). No telemetry, no alerts, run it
  manually after week one; proportionate for a handful of families.
- **Launch-readiness:** one new dev-owned code-side row (values pinned per ADR-0018).
  The week-one review is post-launch by definition, so it is deliberately not a gate row.
  This also fully answers the map's remaining fog note — no other code-side item wants
  a row.

Roadmap 6.5.6's "placeholders until tuned" confirm-bullet now cites ADR-0018. It's nine
env vars, not eight — the ticket title undercounted; the retention knob is the ninth.
