# 12 - silt: per-profile scenes and the gate

**Status:** needs-info
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 7, 8, 10; open call on quota
Blocked by: 23 (built as PR #206, held out of the epic PR until Ed answers)

silt has no share links, so no `/shared`.

- **Measure first.** silt stores `silt:scenes`, `silt:scene:<id>`,
  `silt:thumb:<id>`, `silt:fieldNotes` and `silt:seen`. Report the bytes a
  full set of scenes takes and how many profiles fit under the `localStorage`
  quota if every profile copies the legacy set. If three profiles do not fit
  comfortably, stop and put the numbers in a comment here for Ed: the fallback
  is that only the first profile on a device adopts the legacy scenes.
- Scope those keys per profile through `profileScopedKey` (the scene and thumb
  keys are prefixes, so the scoping wraps the key builder in `sceneStore.ts`
  and `fieldNotesStore.ts`, not each call site). Adopt legacy data per the
  outcome above. Save formats are untouched.
- A switch-player link to `accountUrl(<current URL>)` in silt's own chrome.
- Gate wiring in `main.ts` (no public paths) and `FAMILY_ACCOUNT_URL` in
  `fly.toml`. Not `compose.yml` or `deploy.yml`.
- iwft: per-profile scenes and field notes; legacy adoption. Update
  `apps/silt/CLAUDE.md`.

## Comments

**2026-11-10, measured, then built (QUESTION for Ed: three profiles do not
fit).** Following the orchestrator: everything else is built, nothing special
is done for the fallback, and the numbers are here.

*Quota* (Playwright Chromium 149, WebKit 26.5, Firefox 151, at an http
origin): 5,242,880 characters of key plus value per origin in all three. A
sibling subdomain does not share it (boop's 5MB is not silt's). Not checked on
a real iPhone or in Safari proper.

*One scene* (measured by saving through the app, sizes in characters):

| | blob | thumbnail | total |
|---|---|---|---|
| a painted scene (floor, dunes, pond, plants, run 3s) | 240,604 | 28,669 | ~269,300 |
| the whole grid painted in stripes | 240,569 | 80,397 | ~321,000 |

The blob is fixed size (three raw base64 planes), so the thumbnail is the only
variable. The index costs ~100 per row and `silt:fieldNotes` well under 10KB.
The app has no scene limit; the quota is the limit: **19 painted or 16 busy
scenes per device**, in total.

*If every profile copies a legacy set of S scenes*, the device must hold
(profiles + 1) x S scenes:

| profiles | legacy scenes that fit (painted / busy) |
|---|---|
| 1 | 9 / 8 |
| 2 | 6 / 5 |
| 3 | 4 / 4, with no room left for anyone to save |

So three profiles fit only a legacy set of four scenes or fewer, and nothing
fits once it is full. What happens today with `profileStorage` as it is:

- A profile whose adoption does not fit sees none of the legacy scenes (the
  failed copy is swallowed and retried on every open). Its field notes still
  adopt.
- The legacy scenes stay on the device, and behind the gate nobody can reach
  them any more to delete them. With a large legacy set a profile can meet
  "storage full, delete a scene" on its first save, with an empty list and
  nothing to delete. Only clearing site data recovers.
- The spec's fallback (only the first profile adopts) does not fix that on its
  own: a legacy set over half the quota cannot be copied even once. Moving the
  set to the first profile (rather than copying) would, but ADR 0094 says
  never move.

**Other differences from the text above, and why:**

- `fly.toml` is untouched (orchestrator; the gate stays off in production).
  `main.ts` calls `familyDocumentGateFromEnv(process.env, { publicPaths: [] })`,
  proved on a real port by `src/server/main.test.ts` (copied from the
  starter). The Dockerfile follows `packages/accounts/README.md`.
- Scoping uses `profileStorage`, not hand-wrapped key builders. Its prefix is
  `silt:scene` with no colon, so the index and every blob are adopted together
  or not at all. As two separate entries, a full quota could adopt the index
  without the blobs, and the boot reconcile would then empty it. It also means
  a profile that deletes every scene keeps its empty index and does not adopt
  the legacy scenes again (`profiles.iwft.tsx`). `silt:thumb:` is a second
  prefix.
- `silt:seen` (the first-visit hint) stays on the device: ADR 0094 keeps hints
  unscoped.
- The switch-player link is the player's name, underlined, beside SILT in the
  header. It renders only inside the estate, so CT never shows it; the stack
  check covers it, including 390px with no overflow.
- `scripts/docker-stack-gate-round-trip.mjs` gained a no-`/shared` mode for
  silt. After the merge with `main` that is main's `NO_SHARED=1`, and only the
  WebKit change below is ours. It now reads the gate's 302 from the response
  event rather than `redirectedFrom()`, because Playwright WebKit loses the
  redirect chain when the 302 carries COOP, which every silt response does
  (ADR 0036). The browser behaved correctly; only the observation failed.
- **QUESTION, field notes come back after "forget".** `FieldNotesStore.reset`
  (and loading a scene with no snapshot) removes `silt:fieldNotes` rather than
  writing an empty blob, by design. With a legacy key on the device, the next
  open adopts it again, so forgotten discoveries return after a reload. The
  fix is one line (write an empty progress instead of removing the key), but it
  reverses a documented rule, so it is not made here.

Docker stack (`family hub silt`, project `hoe12`), Chromium 149 and Playwright
WebKit 26.5, all passing: `NO_SHARED=1 node scripts/docker-stack-gate-round-trip.mjs
http://localhost:8089` (the flag was `--no-shared` before the merge with main). A further check registers through silt's
gate, picks Robin, and confirms the link is
`http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8089%2F`. A
scene Robin saves lands under `@<Robin's id>` keys. Following the link to hub,
adding and picking Sky, comes back to silt as Sky with no scenes.


**2026-11-12, resumed with ticket 23's option 1 (PR #206, for Ed to merge or
decline).** PR #206 now targets `main` and has `origin/main` merged in, with
the WebKit response-listener fix reapplied to main's round-trip script.

- **Built.** Scenes are in IndexedDB, per player (ADR 0102). The device's
  localStorage scenes are moved there once and then adopted per player, as
  ADR 0094 is amended to allow. Measurements are in ticket 23.
- **Replaced.** The `silt:scene` prefix trick in `PROFILE_KEYS` described
  above is gone: `PROFILE_KEYS` now lists only `silt:fieldNotes`.
- **Unchanged.** The gate wiring, Dockerfile, switch-player link and
  `reloadOnPlayerChange` are as built before. `fly.toml` is still untouched.
- **Docker stack** (`family hub silt`, project `hoe12`, torn down with
  `-v`), Chromium 149 and WebKit 26.5:
  - `NO_SHARED=1 node scripts/docker-stack-gate-round-trip.mjs
    http://localhost:8089` passes in full. The 302 carries
    `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`.
  - A further check also passes in both browsers. Robin's saved scene is in
    IndexedDB under his account, with nothing in localStorage. The link is
    `http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8089%2F`.
    At 390px the page does not scroll sideways. Picking Sky at hub returns to
    silt with none of Robin's scenes.
