# 01 - Favourite sounds, with a Favourites section atop the picker

**Status:** ready-for-human
**Type:** task
**Reported:** 2026-09-06, user request via Ed

A user can mark any sound as a favourite. The instrument picker
(`apps/boop/src/features/picker/InstrumentPicker.tsx`, groups in
`instrumentGroups.ts`) shows a **Favourites** section at the top - only when
at least one favourite exists. The toggle is a star-shaped button on each
sound; the star fills gold when the sound is a favourite.

## Design

- **Persistence:** a new localStorage key (e.g. `boop:favourites`) holding
  instrument ids, through the existing `storage.ts` seam idiom (never throws,
  unreadable degrades to empty). Do **not** put it in the `boop:save`
  document - it is a preference, not part of a boop, and ADR 0025's v1 shape
  stays frozen. Favourited ids that the loaded kit no longer contains are
  ignored on read, kept on write (forward-compat, same spirit as the save
  format).
- **Picker:** a Favourites group rendered before the existing groups, present
  only when non-empty. Sounds appear there *in addition to* their home group
  (a kid should still find Cowbell under Drums). Order within Favourites:
  manifest order, not favouriting order - stable and predictable.
- **Star button:** on each sound row/tile in the picker, `aria-pressed`,
  accessible name like "Favourite Cowbell". Outline star normally, gold fill
  when on. Must not steal the tap that auditions/selects the sound - separate
  hit target, comfortably kid-sized.
- Follow the picker's existing SCSS-module styling; no shared UI (hard rule 2).

## Acceptance

- [x] Starring a sound shows the Favourites section with it; unstarring the
      last one removes the section
- [x] Favourites survive a reload; a corrupt/missing blob means no favourites
      and no error
- [x] The star toggles without selecting/auditioning the sound, and works by
      keyboard
- [x] Unit tests for the favourites store + group derivation; one `.iwft`:
      star, reload, see the section (pragmatic split)

## Comments

**2026-09-06 (Ed):** design approved as written after walking through the
decisions (separate `boop:favourites` key, copy-not-move into the Favourites
group, manifest order, separate star hit target). No changes.

**2026-09-06 (agent):** built as designed on branch `boop-favourite-sounds`:
`persistence/favourites.ts` (+ `useFavourites.ts`), the Favourites section in
`instrumentGroups.ts`, and the star buttons in `InstrumentPicker.tsx`. Unit
tests for the store and the derivation, one `favouriteSounds.iwft.tsx`. All
acceptance boxes verified by tests; ready-for-human review.
