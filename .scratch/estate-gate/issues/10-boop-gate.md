# 10 - boop: per-profile saves, always-on sync, `/shared`, and the gate

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 5-10
Blocked by: 01, 02 (merge only after 05 is live)

The first gated app and the reference the other app tickets copy. Ship as
stacked PRs in this order if one PR gets too large.

1. **Per-profile saves.** `boop:save` and `boop:favourites` go through
   `profileScopedKey` with the account from `readFamilySession()`;
   `adoptLegacyDocument` runs on first open. Hints and other device
   preferences stay unscoped. The frozen `boop:save` v1 format (ADR 0025) is
   untouched; only the key it is stored under changes.
2. **Sync is always on for a signed-in profile.** Remove the import offer,
   the decline path and `boop:syncedAccount` handling from `src/sync/`. Pull,
   merge hook and push stay as ADR 0080 describes; the SaveStore `slotKey`
   stays `boop:save`. Amend ADR 0080.
3. **`/shared`.** A new route that decodes the existing `#g=` payload and
   opens it with persistence and sync switched off: the visitor can play and
   edit, nothing is written. "Keep this boop" links to `/#g=...`. The Share
   action now produces `/shared#g=...`. A root `/#g=` link keeps today's
   behaviour for a signed-in visitor. Decode stays total (ADR 0026).
4. **The chip** links to `accountUrl(<current URL>)` so switching player
   returns here.
5. **Gate.** `main.ts` passes `familyDocumentGate({ accountUrl, publicPaths:
   ['/shared'] })` when `FAMILY_ACCOUNT_URL` is set; add it to `fly.toml`
   `[env]` as `https://homeofed.com/account`. Do not touch `compose.yml` or
   `deploy.yml` (ticket 03).

iwft: profile A's boops are not profile B's; legacy boops appear for both;
`/shared` writes nothing to `localStorage`; keep-this carries the fragment.
Finish with the docker-stack round trip (`family hub boop`): signed out ->
redirected -> sign in -> pick -> back on boop, and a `/shared` link opening
with no session. Update `apps/boop/CLAUDE.md`.

## Comments
