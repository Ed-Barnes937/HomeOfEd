# 12 — Hub: flip Silt card to LIVE

**What to build:** The hub's Silt card (from ticket 01) becomes a real
doorway: the `SOON` label is replaced by the `LIVE` status, the card links to
`https://silt.homeofed.com`, and the deployment date is recorded so the hub's
"New" pill shows for the launch window. The coming-soon animation stays — it
is the card's preview.

**Blocked by:** 01 — Hub: Silt "coming soon" card; 11 — Deploy Silt
(human-gated)

**Status:** ready-for-agent — **not started; gated on ticket 11's human half**

> Skipped by the build orchestrator by design: this ticket can only be done
> after the human has run go-live, since `deployedAt` must be the real launch
> date and the card must not claim LIVE before the site serves.

- [ ] Silt card shows `LIVE` and links to `https://silt.homeofed.com`
- [ ] `deployedAt` set to the actual go-live date; "New" pill renders
- [ ] Hub tests, lint, typecheck green
