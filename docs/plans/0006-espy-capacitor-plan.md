# 0006 — espy mobile (Capacitor): initial-PR plan

- **Status:** Proposed
- **Date:** 2026-07-09
- **Related:** [ADR 0017](../adr/0017-espy-capacitor-mobile.md) (the
  decision this plan implements), [ADR 0016](../adr/0016-espy-doodle.md),
  [ADR 0008](../adr/0008-apps-without-a-database.md), the
  [phase-4 runbook](../runbooks/phase-4-go-live.md).

## 1. Summary

Wrap `apps/espy`'s existing web build in a Capacitor native shell so it can
ship to the iOS and Android stores, reusing the whole codebase. This plan
covers **only the initial PR** — everything verifiable in this repo without a
native SDK. Generating the native projects, building on-device, and submitting
to the stores are human-gated follow-ups (§7), mirroring how infra is handled
elsewhere in this repo.

Decisions already fixed by [ADR 0017](../adr/0017-espy-capacitor-mobile.md):

| Decision | Choice |
| --- | --- |
| Tool | **Capacitor**, wrapping the existing `vite build` — not a PWA-only path, not React Native. |
| Location | Inside `apps/espy` (`capacitor.config.ts`, later `ios/`, `android/`). |
| Assets | **Bundled, offline** (`webDir: 'dist'`, no committed `server.url`). |
| Code change | One: `save()` gains a native Share/Filesystem branch behind the existing capability seam. |
| Web deploy | **Untouched** — Fly/Cloudflare/CI keep shipping the web version. |
| Initial-PR line | Stops **before** `npx cap add`; native folders gitignored, not committed. |

Assumptions this plan makes (flagged, not asked — overrule if wrong):

- **Bundle ID** `com.homeofed.espy`, **app name** "Espy". Both are
  placeholders tied to the placeholder product name — the bundle ID must be
  final before store submission (ADR 0017 consequence).
- **Portrait + landscape**, no orientation lock (the canvas is fluid-responsive
  already, ADR 0016 §5).
- **No native plugins beyond** Share, Filesystem, Status Bar, App. No push, no
  deep links, no camera, no analytics.
- Save-to-device on native writes the PNG to the **cache** directory and hands
  it to the OS share sheet (share → Photos/Files/AirDrop). No Photos-library
  write permission is requested in v1.
- Minimum OS targets are Capacitor 6's defaults (iOS 14+, Android 6+); not
  pinned in this PR since no native project is generated yet.

## 2. Non-goals / follow-ups

Generating `ios/`/`android/` (`cap add`), on-device builds, app icon + splash
asset generation, signing / provisioning / App Store Connect / Play Console,
push notifications, deep links, native-only features, a PWA manifest +
service worker (a separate, additive path if we want installable-web too). None
are in the initial PR.

## 3. What the initial PR touches

All within `apps/espy` plus the two docs already written:

```
apps/espy/
  package.json              + capacitor deps + cap:* scripts
  capacitor.config.ts       NEW — appId, appName, webDir: 'dist', offline
  .gitignore                + ios/ android/ + capacitor local artifacts
  vite.config.ts            pin `base: ''` so bundled assets resolve under
                            a file://-style origin, not just https://
  src/features/doodle/
    save.ts                 NEW — pure save-target selection over injected
                            capabilities (web share / download / native)
    save.test.ts            NEW — unit tests both branches with fakes
    useDoodle.ts            doSave() delegates to save.ts; native branch added
  src/pages/DoodlePage.module.scss   safe-area insets (env(safe-area-inset-*))
  CLAUDE.md / README.md     document the mobile build path + cap:* scripts
docs/adr/0017-espy-capacitor-mobile.md   (written)
docs/plans/0006-espy-capacitor-plan.md   (this file)
```

No package changes, no web-deploy changes, no CI changes.

## 4. The Save bridge (the one real code change)

Today `useDoodle.ts` `doSave()` builds a PNG `Blob`, wraps it in a `File`, and
branches inline on `navigator.canShare`. Extract the *target selection* into a
pure helper so it is testable without a browser or a device — the repo's
inject-and-fake rule (root CLAUDE §5):

```ts
// save.ts — pure, no DOM/canvas; capabilities are injected
export interface SaveCaps {
  isNative: boolean
  canShareFiles: (file: File) => boolean            // navigator.canShare
  shareFiles: (file: File, title: string) => Promise<void>   // web Web Share
  download: (blob: Blob, filename: string) => void  // anchor click
  nativeShare: (blob: Blob, filename: string) => Promise<void> // Filesystem+Share
}

export async function saveImage(blob: Blob, filename: string, title: string, caps: SaveCaps): Promise<void>
// native → caps.nativeShare; else canShareFiles → shareFiles; else download.
// AbortError (user dismissed the sheet) is swallowed; other errors rethrow.
```

- **Web wiring** (`useDoodle.ts`, prod): `isNative:false`,
  `canShareFiles`/`shareFiles` from `navigator`, `download` the existing
  anchor path. Behaviour identical to today.
- **Native wiring**: `isNative` = `Capacitor.isNativePlatform()`;
  `nativeShare` writes the blob (base64) to `Filesystem` cache then
  `Share.share({ files: [uri] })`. Imported lazily / guarded so the web bundle
  never pulls the plugins into its runtime path.
- **Tests** (`save.test.ts`, red→green): native path calls `nativeShare` only;
  web path with `canShareFiles:true` calls `shareFiles`; web path with
  `canShareFiles:false` calls `download`; `AbortError` from a share is
  swallowed, any other error rethrows. Fakes for every cap — no real Capacitor,
  no real canvas.

## 5. Config + wiring detail

- **`capacitor.config.ts`**: `appId: 'com.homeofed.espy'`,
  `appName: 'Espy'`, `webDir: 'dist'`. `StatusBar`/`SplashScreen` plugin
  config minimal (sketchbook paper background `#fffdf4`, dark content). No
  `server` block committed.
- **`package.json`**: deps `@capacitor/core`, `@capacitor/share`,
  `@capacitor/filesystem`, `@capacitor/status-bar`, `@capacitor/app`;
  devDeps `@capacitor/cli`. Scripts: `cap:sync` (`cap sync`), and thin
  `cap:ios` / `cap:android` (`cap open ...`) that only work once a human has
  run `cap add` — documented as such.
- **`vite.config.ts`**: set `base: ''` (relative asset URLs) so `index.html`
  loads assets under the WebView's `capacitor://`/`file://` origin. Verify the
  **web** build still serves correctly from `/` after this change (Fly serves
  at the domain root — relative base is compatible, but it must be re-smoked).
- **Safe areas** (`DoodlePage.module.scss`): pad the header/toolbar with
  `env(safe-area-inset-*)` so chrome clears notches and the home indicator.
  A no-op in a desktop browser, so the web layout is unchanged.

## 6. Task list (TDD, each task ends green)

Verify loop for every task: `pnpm lint && pnpm typecheck &&
pnpm test --filter=espy && pnpm build --filter=espy`.

- **C1 — ADR + plan.** [ADR 0017](../adr/0017-espy-capacitor-mobile.md) and
  this file. *(done — this PR opens with them.)*
- **C2 — Save seam refactor (no behaviour change).** Extract `save.ts` +
  `save.test.ts`; rewire `useDoodle.ts`'s `doSave()` to build the web `SaveCaps`
  and call `saveImage`. *Verify:* unit tests green; the existing `doodle.iwft`
  save assertion still passes (web behaviour identical); full loop green.
- **C3 — Native branch.** Add the Capacitor deps; implement `nativeShare`
  (Filesystem + Share) behind the `isNative` guard; extend `save.test.ts` for
  the native path with fakes. *Verify:* loop green; web bundle unaffected
  (native plugins not in the web runtime path — spot-check the built bundle).
- **C4 — Config + safe areas.** `capacitor.config.ts`, `cap:*` scripts,
  `base: ''` in `vite.config.ts`, `.gitignore` entries, safe-area CSS.
  *Verify:* loop green; **re-smoke the web build** (`docker compose up espy`
  → curl `/health`, SPA index + hashed asset) to confirm `base: ''` didn't
  break web asset loading.
- **C5 — Docs.** Scoped `CLAUDE.md` + `README.md`: the mobile build path, the
  `cap:*` scripts, and the explicit "run `cap add` yourself" boundary. *Verify:*
  loop green; docs describe exactly the human follow-up in §7.

That is the initial PR. Everything below is a separate, human-gated PR.

## 7. Human-gated follow-up (agents stop here)

Requires a Mac with Xcode and/or Android Studio, and paid store accounts —
the mobile equivalent of the Fly/Cloudflare steps root CLAUDE marks human-only.

```bash
# On a Mac, from apps/espy, after the initial PR merges:
pnpm build --filter=espy          # produce dist/
npx cap add ios                        # generates ios/  (Xcode required)
npx cap add android                    # generates android/ (Android Studio)
npx cap sync                           # copies dist/ + plugins into both
npx cap open ios                       # build/run in Xcode
npx cap open android                   # build/run in Android Studio
```

Then, human-owned and out of any agent's scope:

- **Icons + splash**: run `@capacitor/assets` against a source logo; commit the
  generated assets.
- **Signing**: iOS provisioning profile + certificate (Apple Developer,
  ~$99/yr); Android keystore (keep it out of git; document where it lives).
- **Store listings**: App Store Connect + Google Play Console — privacy
  declarations, age rating, screenshots, review submission.
- **Decide `ios/`/`android/` commit-vs-ignore** (ADR 0017 §7) once they exist.
- **Finalise the product name** before the listing is created — the bundle ID
  `com.homeofed.espy` is hard to change afterwards.

> **ℹ Still a placeholder.** `espy` / `com.homeofed.espy` are temporary
> (ADR 0016). Unlike the web subdomain, a store bundle ID cannot be renamed
> after publish — settle the name before this follow-up runs.
