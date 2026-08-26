# Check the Cloudflare zone's IP Geolocation setting

Type: task
Status: closed (2026-08-19)
Assignee: ed-barnes937 (claimed 2026-08-19)
Blocked by: —

## Question

Nothing to decide — a two-minute human dashboard check that the enforcement-layer decision's
research couldn't settle from docs
([answer, item 1](01-country-blocking-primitives.md)).

`CF-IPCountry` only reaches the origin if the zone's **IP Geolocation** setting (dashboard:
homeofed.com → Network → IP Geolocation) is enabled — Cloudflare does not document it as
on-by-default. Any app-level enforcement reading `CF-IPCountry` silently sees no header (or
only the direct-origin gap) if it's off.

**HITL:** Cloudflare dashboard access is human-gated in this repo (root `CLAUDE.md` —
Cloudflare changes are infra). Reading a setting mutates nothing, but the agent has no
dashboard; hand the human this checklist:

1. Cloudflare dashboard → homeofed.com zone → **Network** → find **IP Geolocation**.
2. Record whether it is **on** or **off** (don't change it yet — flipping it on is a step for
   the go-live checklist once the enforcement layer is decided).
3. While there, note the zone's plan (expected: Free) to confirm the 5-WAF-rule quota
   assumption.

**Record in the answer:** on/off, the plan, and the date checked.

## Answer

Checked by the human on **2026-08-19** (dashboard: homeofed.com zone → Network → IP
Geolocation):

- **IP Geolocation: ON.** `CF-IPCountry` reaches the origin on through-Cloudflare requests,
  so the ADR-0011/0012 app-level hook has its input today. The provisional go-live step
  "flip IP Geolocation on" is unnecessary — the go-live verify keeps only the *check* that
  it is still on (the 451-to-UK-visitors failure signature in the comment below remains the
  post-launch diagnostic if it is ever switched off).
- **Plan: Free.** Confirms the 5-WAF-rule quota assumption from the
  [country-blocking research](01-country-blocking-primitives.md) — the launch-day
  `ip.src.country ne "GB"` rule fits comfortably.

## Comments

**2026-08-01 (from the ticket-04 resolution / ADR-0013):** this check gains a live failure
signature. The hook's refusal is now a distinctive `451` status-notice page (ADR-0013). If
the zone's IP Geolocation setting is off, the hook sees no `CF-IPCountry` on
through-Cloudflare requests and fails closed — so **genuine UK visitors seeing the 451 page
is the observable symptom that this setting is off**. Useful both for the go-live verify and
for diagnosing it post-launch.
