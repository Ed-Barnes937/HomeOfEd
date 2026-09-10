# 05 - Decision sitting: account direction + consolidation, together

**Status:** resolved
**Type:** grilling
**Map:** ../map.md
Blocked by: 03, 04, 06, 07

> 2026-09-08: re-blocked at Ed's request - before the sitting he wants a cost
> model of growth to ~100 users across setups (06) and a survey of cheap
> hosting options beyond Fly (07). Back to ready-for-human when both resolve.

## Question

HITL - this is Ed's ticket; an agent facilitates, never answers for him.
Invoke /grilling and /domain-modeling. With both options papers on the table
(tickets 03 and 04), Ed decides in one sitting:

- **Account layer:** which option, where the account UI lives, what the
  smallest first slice is, and whether the COPPA/GDPR-K flag gates the first
  slice or only later ones.
- **Infra:** status quo, full consolidation, or middle ground - chosen with
  the account-layer answer in hand, since a central identity/save service
  changes what the machines need to host.

The source tickets said it plainly: these pull on the same architecture and
must be decided together. Record both decisions here, echo them to
`.scratch/account-layer/issues/01` and `.scratch/infra-cost/issues/01`, and
graduate the map's fog (first-slice spec, migration plan, consolidation
execution plan) into fresh tickets as the decisions allow.

## Answer

Sitting run 2026-09-08 to 2026-09-10 via Lavish review surface (grilling, two
rounds; /grilling + /domain-modeling invoked as this ticket asked). All 13
decisions taken; frontier empty. Ed took every recommendation except Lever A,
which he deferred.

### Round 1 (foundational) - Ed decided:

1. **Identity source: fresh minimal identity service** (not sprout
   extraction). Sprout swaps in later via its ADR 0012 AuthProvider path.
   Ed's note: explore Option C vs Option D properly before the hosting call -
   taken up in Round 2.
2. **Save storage: central SaveStore (Option C)** - opaque blobs keyed
   `(appId, accountId, slotKey)`; apps stay stateless.
3. **Consolidation: status quo, question closed** - refuted by measurement at
   0 and ~100 users.
4. **Lever B: no** - sprout-pipeline stays its own app; ADR 0013 isolation
   kept.
5. **Account UI: hub owns login + family management.** Ed's note: "Definitely
   the hub - if we add monetisation in the future we'd most likely gate
   access through the hub."
6. **hoe-pg restore rehearsal: yes, its own small effort outside this map.**
   Ed asked whether it has real-world cost - answered in Round 2: pennies of
   throwaway machine-hours plus roughly an hour of his time; no ongoing cost
   unless offsite dumps are added later.

### Round 2 (dependent) - Ed decided:

7. **Backend hosting: Option C proper - own scale-to-zero "family" app +
   logical DB in hoe-pg.** The C-vs-D exploration Ed asked for showed D's
   free hosting is illusory: D forces hub always-on forever, forfeiting
   Lever A's ~$3.24/mo, so D nets ~$3.16/mo dearer than C + Lever A while
   making the launcher the estate's most critical app. Ed's monetisation
   instinct (gate access through the hub) holds under C: hub owns the gate
   screens (decision 5); enforcement is token claims checked at each app's
   `ctx.auth`.
8. **Lever A (hub scale-to-zero): DEFERRED** - revisit once the first slice
   ships and the apex/login cold start can be felt for real. The only
   non-recommended pick of the sitting; hub stays `min_machines_running = 1`
   until then.
9. **Save-path wiring: browser-direct** to the family service's tRPC;
   contract types in `packages/accounts` (the sprout-shared precedent). App
   machines stay asleep on every save.
10. **First slice: boop `boop:save`** behind an account, nothing else. Ed's
    question "does having account-specific saves mean we need to load each
    save into backend DBs?" - answered: **no**. Saves live only in the family
    service's logical DB as opaque blobs; app backends never see them (boop
    stays stateless, no DB). The browser fetches the blob directly and
    decodes it client-side exactly as it decodes localStorage today.
    Per-app backend DBs was Option B, which decision 2 rejected.
11. **Legal gate: fresh ADR-0019-style posture** - household pilot +
    invite-code from day one; a short legal ADR before any non-household
    account exists. Household-only means the first slice ships to the family
    pre-counsel.
12. **Import conflict default: LWW-per-slot + per-app merge hook at import**
    (boop unions creations; silt scenes union naturally; espy is genuine
    LWW). No sync engine in v1 - save/load whole slot only.
13. **Remaining bill accepted as baseline** (~$13.30/mo today, ~$10 if Lever
    A later lands, +$0.08/mo family app). Cost question closed; source
    ticket resolved.

### Graduated from the map's fog

- [08 - First-slice spec: boop behind a family account](08-first-slice-spec-boop.md)
  (carries the localStorage import plan and the boop merge hook).
- [09 - Legal gate ADR](09-legal-gate-adr.md) (fresh ADR-0019-style gate,
  drafted for Ed's review).
- [10 - Re-point waiting consumers](10-repoint-waiting-consumers.md)
  (boop-clips 02, boop-recorded-sounds 01, silt per-scene note).
- hoe-pg restore rehearsal: own effort at
  `.scratch/hoe-pg-restore-rehearsal/issues/01-restore-rehearsal.md`.
- Dropped as moot: consolidation execution plan (status quo won); account UI
  location ticket (settled: hub).

Decisions echoed to `.scratch/account-layer/issues/01` and
`.scratch/infra-cost/issues/01` (both resolved).
