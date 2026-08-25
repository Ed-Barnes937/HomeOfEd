# 12 — ToS & Privacy draft documents + Settings links

**What to build:** A visitor can open `/terms` and `/privacy` and see self-contained
draft skeleton documents; a parent in Settings can click the Privacy Policy and Terms of
Service links and land on them. (ADR-0015 items 2–4; spec "ToS / Privacy pages".)

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `GET /terms` and `GET /privacy` return self-contained static HTML documents served
      from versioned app code via the existing `registerRoutes` wiring — inline styles
      only, no external assets or scripts. They are **not** SPA routes and **not** files
      in the build-output static dir.
- [ ] Each page shows a prominent "**Draft — not yet in force**" banner, then the section
      headings from the counsel clause brief (`legal-content-requirements.md`) with
      one-line notes of what each section will cover. No invented legal prose.
- [ ] The Settings page's two dead `href="#"` anchors become plain full-page navigations
      to `/terms` and `/privacy`.
- [ ] Server unit tests assert each page's status, content type, draft banner, and
      expected headings.
- [ ] A whole-frontend test proves the Settings links navigate to the documents.
- [ ] Verify loop green (`pnpm lint`, `pnpm typecheck`, sprout tests).

## Comments
