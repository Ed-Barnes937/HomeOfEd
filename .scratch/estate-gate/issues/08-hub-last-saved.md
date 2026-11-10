# 08 - hub: `/account` shows when each profile last saved

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 12
Blocked by: 04, 06

The only place a parent learns whether syncing works. Apps stay silent.

- In `ChildProfilesCard` (and the parent's own row), one quiet line per app
  with a save: "boop: saved 2 days ago". No line when a profile has no saves;
  no warning styling, staleness is the signal.
- Uses ticket 04's procedure through the family client; a failed read shows
  nothing rather than an error.
- iwft with `FakeFamilyClient`: saves present, none, read fails.

## Comments

- 2026-11-10 (implementer): built as ticket says, recorded as an amendment to
  ADR 0081. Deviations and choices:
  - The parent has no row in `ChildProfilesCard`, so the parent's lines sit
    under "Signed in as" rather than in a new row there (open question for Ed).
  - The lines use `--muted` rather than `--faint` (the `@handle` colour), which
    measured about 2.6:1 on the card; this is the one place the information
    appears.
  - Signing out also writes `[]` into the summary's cache, like `children` and
    `me`, so a shared device never shows the previous household's times.
  - The fake already had `saveSummary` (ticket 04); the harness gained seeded
    saves at a chosen age and a switch that fails `saveSummary` alone. The
    failed-read iwft runs react-query's retries out on `page.clock` and was
    checked to go red when the component renders the error.
