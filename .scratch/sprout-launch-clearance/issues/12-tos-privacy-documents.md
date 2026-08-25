# 12 — ToS & Privacy draft documents + Settings links

**What to build:** A visitor can open `/terms` and `/privacy` and see self-contained
draft skeleton documents; a parent in Settings can click the Privacy Policy and Terms of
Service links and land on them. (ADR-0015 items 2–4; spec "ToS / Privacy pages".)

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] `GET /terms` and `GET /privacy` return self-contained static HTML documents served
      from versioned app code via the existing `registerRoutes` wiring — inline styles
      only, no external assets or scripts. They are **not** SPA routes and **not** files
      in the build-output static dir.
- [x] Each page shows a prominent "**Draft — not yet in force**" banner, then the section
      headings from the counsel clause brief (`legal-content-requirements.md`) with
      one-line notes of what each section will cover. No invented legal prose.
- [x] The Settings page's two dead `href="#"` anchors become plain full-page navigations
      to `/terms` and `/privacy`.
- [x] Server unit tests assert each page's status, content type, draft banner, and
      expected headings.
- [x] A whole-frontend test proves the Settings links navigate to the documents.
- [x] Verify loop green (`pnpm lint`, `pnpm typecheck`, sprout tests).

## Comments

**2026-08-25 (agent):** Built as specified. `apps/sprout/src/server/legal-docs.ts` holds
the two documents as versioned template strings (headings mirror
`legal-content-requirements.md` clause-for-clause) and `registerLegalDocRoutes`, mounted
from `main.ts`'s `registerRoutes` hook. Unit tests (`legal-docs.test.ts`) drive the real
wiring over `buildAppServer` + inject: status, content type, banner, all 14 headings, and
a no-external-assets check. The `.iwft` tests click each Settings link and land on the
real exported document HTML (served via the sanctioned `page.route` fallback — the
documents are not SPA routes, so the PGlite trampoline never serves them). Verify loop
green: lint, typecheck, 152 unit + 23 whole-frontend tests. Two-axis code review found no
hard violations; the geo-exemption of these paths remains with ticket 13.
