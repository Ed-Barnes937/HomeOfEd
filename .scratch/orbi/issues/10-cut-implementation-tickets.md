# 10 — Cut the implementation ticket set

**Type:** task
**Status:** open
**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 11

## Question

The destination act. With every decision above resolved, cut the v1
implementation tickets (continuing the numbering in this directory), each
self-contained with verify criteria, sized for a single Sonnet/Opus agent
session, marked `ready-for-agent` — flagging the few that warrant a Fable
subagent. Use `/to-tickets` if it fits.

Fixed sequencing already decided (map Notes):

- First ticket: "coming soon" orbi card on the hub homepage (ships to `main`
  immediately, independent of the rest).
- Early ticket: scaffold `apps/orbi` from `templates/starter` per
  `docs/how-to/adding-an-app.md` (ports 3010/3110/8090, claim the registry
  row), including self-hosted IBM Plex Mono woff2 (none exists in the repo)
  and the Flight Console design tokens.
- Second-to-last: go-live (Fly app, DNS, cert, CI deploy job — human-gated
  runbook).
- Last: flip the hub card from "coming soon" to live.

## Answer
