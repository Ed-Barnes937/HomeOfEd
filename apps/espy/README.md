# espy

A calm, single-screen, fully client-side canvas doodling toy: procedurally-
generated ink blots on warm paper that the user draws on and turns into little
creatures with freehand lines and stamped eyes. No accounts, no backend data,
no gamification. Lives at `espy.homeofed.com`.

Full spec: [`.claude/tasks/espy-doodle/spec.md`](../../.claude/tasks/espy-doodle/spec.md) ·
ratified decisions: [`.claude/tasks/espy-doodle/decisions.md`](../../.claude/tasks/espy-doodle/decisions.md) ·
divergences from the design guide: [ADR 0016](../../docs/adr/0016-espy-doodle.md).

**No database** — see [ADR 0008](../../docs/adr/0008-apps-without-a-database.md).
The layered backend skeleton (tRPC → handler, no Store) exists only for
platform convention and `/health`; the frontend makes no tRPC calls and all
drawing state lives client-side. The one exception: the *current* drawing is
mirrored to `localStorage` (`src/features/doodle/session.ts`) so an accidental
reload doesn't lose it — never a gallery of past work.

## Run it

```
pnpm dev --filter=espy
```

Simulator mode: frontend + the real tRPC router on port **3006**, no
persistence, HMR. Restart to pick up server-side changes.

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=espy` | real router, no Store (Vite middleware) |
| .iwft | `pnpm test --filter=espy` | real router in-browser, no Store |
| production | `pnpm build && pnpm start` | real router, shallow `/health` |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + shallow
`/health`). No database, no migrations.

## The command loop

Everything drawn lives as an ordered list of immutable ops
(`field` / `stroke` / `eye`) in `features/doodle/engine/history.ts`; the canvas
is a projection of that list, replayed by `render/surface.ts`. `useDoodle.ts`
is the integration keystone — it owns the canvas lifecycle, pointer handling,
history, session restore, the bloom-in animation, and save/share, and exposes
`newPage()` / `undo()` / `save()` plus `tool`/`nib` state to `DoodlePage.tsx`.
See [`CLAUDE.md`](CLAUDE.md) for the full layout map, commands, ports, and
scoped rules.

## Mobile (Capacitor)

The iOS/Android app is the **same `vite build` output** wrapped in a Capacitor
WebView — no fork, no second UI, assets bundled and offline
([ADR 0017](../../docs/adr/0017-espy-capacitor-mobile.md)). The web deploy
(Fly/Cloudflare/CI) is untouched.

What's in this repo:

- `capacitor.config.ts` — `com.homeofed.espy` / "Espy" / `webDir: 'dist'`.
- The save bridge: `save()` routes through `src/features/doodle/save.ts`
  (injected capabilities); under the native shell it writes the PNG to the
  Filesystem cache and opens the OS share sheet
  (`src/features/doodle/save.native.ts`, lazy-loaded so the web bundle's
  runtime path is unchanged).
- Scripts: `cap:sync` (copy `dist/` + plugins into the native projects),
  `cap:ios` / `cap:android` (open Xcode / Android Studio). All three require
  the native projects to exist first — see below.

**The native projects (`ios/`, `android/`) are committed** (ADR 0017 §7,
decided 2026-07-20) — they were generated once with `npx cap add` and are now
source, like `fly.toml`. Capacitor's nested `.gitignore` files keep the
regenerated bulk (SPM/Pods, Gradle `build/`, the synced `public/`) out of git.
Don't re-run `cap add`.

Day-to-day loop after any web change — the WebView only sees `dist/` as of
the last sync:

```bash
pnpm build --filter=espy      # produce dist/
cd apps/espy
npx cap sync                  # copy dist/ + plugin wiring into ios/ + android/
npx cap open ios              # build/run in Xcode      (or: pnpm cap:ios)
npx cap open android          # build/run in Android Studio (pnpm cap:android)
```

Still human-owned (ADR 0017 §6,
[plan 0006 §7](../../docs/plans/0006-espy-capacitor-plan.md)): on-device
builds/signing and the App Store / Play Console listings. Real icons + splash
screens (replacing the Capacitor template placeholders) come from a
1024×1024 source logo:

```bash
cd apps/espy                  # with assets/logo.png in place
npx @capacitor/assets generate
```
