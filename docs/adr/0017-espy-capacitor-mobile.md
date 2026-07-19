# 0017 — espy mobile: Capacitor over the existing web build

- **Status:** Accepted (2026-07-19)
- **Date:** 2026-07-09
- **Related:** [ADR 0003](0003-spa-default-tanstack-start-opt-in.md) (SPA
  default), [ADR 0008](0008-apps-without-a-database.md) (stateless baseline),
  [ADR 0016](0016-espy-doodle.md) (the doodle app itself),
  [plan 0006](../plans/0006-espy-capacitor-plan.md) (the implementation
  plan this ADR gates).

## Context

`apps/espy` is a stateless, fully client-side SPA: procedural canvas,
localStorage-only persistence, no server data (its tRPC skeleton exists only
to satisfy `createAppServer` and serves a shallow `/health` — the frontend
makes no tRPC calls, exactly like boids). We want it in the iOS and Android app
stores without abandoning the web version at `espy.homeofed.com`.

Three paths were weighed (see the scoping discussion): a PWA (cheapest, no
store presence), **Capacitor** (wrap the existing Vite build in a native
WebView + native plugins), and React Native (a rewrite). For a client-only
canvas toy with no backend, Capacitor reuses ~100% of the code and is the only
option that reaches the stores without a rewrite. React Native would preserve
the pure `engine/*` (it is plain TS) but force a reimplementation of
`render/surface.ts` against a native canvas (`react-native-skia`) plus all
React chrome — weeks of work for no user-visible gain over a WebView on an app
this size.

This ADR records the decision to use Capacitor and the boundaries around it.
The step-by-step lives in [plan 0006](../plans/0006-espy-capacitor-plan.md).

## Decision

1. **Capacitor, wrapping the existing web build.** The mobile app *is* the
   `vite build` output loaded into a native WebView. There is no fork, no
   second UI, no second copy of the engine. The web build stays the single
   source of truth; the Fly/Cloudflare web deploy is untouched.

2. **Capacitor lives inside `apps/espy`.** `capacitor.config.ts` and the
   generated native projects (`ios/`, `android/`) are part of the same leaf
   app, consuming that app's own `dist/`. This does **not** breach the
   leaf-node rule (root CLAUDE §1): nothing imports across apps — the native
   shell wraps the app's own build output. It is not shared UI or a package,
   so it does not belong in `packages/*` (plumbing only).

3. **Assets bundled, offline-first, no `server.url`.** `webDir: 'dist'` and the
   built assets ship inside the app bundle. `server.url` (live-reload against a
   dev server) is a local-dev convenience only and is never committed. The app
   runs with no network — consistent with its stateless, localStorage design.

4. **One code change: the Save bridge, behind the existing capability seam.**
   `useDoodle.ts`'s `save()` already branches on a runtime capability
   (`navigator.canShare`). It gains a native branch — when running under
   Capacitor, write the PNG via `@capacitor/filesystem` and invoke the native
   share sheet via `@capacitor/share`, else the current web path (Web Share →
   anchor download) unchanged. The platform/capability selection is extracted
   into an injectable helper so both branches are unit-tested with fakes (root
   CLAUDE §5, fakes over mocks). The web build's behaviour does not change.

5. **The `server/` skeleton and web deploy are untouched.** Capacitor bundles
   static assets only; it never runs the tRPC server. Because the frontend
   makes no tRPC calls, the absence of a server in the WebView changes nothing.
   `fly.toml`, the Dockerfile, `compose.yml`, and the `deploy-espy` CI job
   keep shipping the web version exactly as today.

6. **Native folders and store submission are human-gated, like infra.**
   `npx cap add ios/android` requires Xcode / Android Studio and cannot run in
   this repo's CI; signing certificates, provisioning profiles, App Store
   Connect, and the Play Console are the mobile equivalent of the Fly/Cloudflare
   infrastructure that root CLAUDE marks human-only. Agents write the config and
   the bridge; a human runs `cap add`, builds on a Mac, and submits. The
   **initial PR therefore stops before `cap add`** — it adds deps, config, the
   Save bridge, safe-area CSS, and docs, all verifiable with `lint` /
   `typecheck` / `test` / `build` and no native SDK. Generating the native
   projects and the store pipeline are follow-up PRs (plan 0006 §7).

7. **Initial PR does not commit `ios/`/`android/`.** They are generated, large,
   and untestable in CI, and they drag in signing config. The initial PR
   gitignores them. Whether to commit them once generated (infra-as-code, like
   `fly.toml`) or keep regenerating is deferred to the follow-up that runs
   `cap add` — flagged, not decided here.

## Consequences

- The web app carries a few new devDependencies (`@capacitor/cli`,
  `@capacitor/core`) and runtime plugins (`@capacitor/share`,
  `@capacitor/filesystem`, `@capacitor/status-bar`, `@capacitor/app`). They are
  tree-shaken out of the web bundle's hot path — the native branch is behind a
  runtime `Capacitor.isNativePlatform()` guard — so the web build is
  functionally unchanged.
- There is now a second consumer of `dist/`: Fly (web) and Capacitor (native).
  Any build-output assumption (base path, asset hashing) must hold for a
  `file://`/`capacitor://` origin as well as `https://`. The plan pins Vite's
  `base` accordingly.
- `save()` grows a real dependency on injected capabilities. This is the same
  capability-detected pattern ADR 0016 §5 already chose, extended one level, so
  it is additive on an existing seam, not a new mechanism.
- Store presence brings store obligations the web version never had: an Apple
  Developer account and Play Console account (paid), privacy declarations,
  age-rating, review latency, and native app icons/splash assets. These are
  real, human-owned, and out of scope for the initial PR.
- The name seeds the **bundle identifier** `com.homeofed.espy`. A bundle ID is
  hard to change after a store listing exists — **espy was confirmed as the
  final name on 2026-07-19**, so `com.homeofed.espy` is safe to bake in.
