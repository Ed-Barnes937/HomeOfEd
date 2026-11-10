# 08 - hub: `/account` shows when each profile last saved

**Status:** ready-for-agent
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
