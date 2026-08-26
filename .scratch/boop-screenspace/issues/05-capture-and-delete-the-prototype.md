# Capture the prototype as a primary source, then keep it off main

Type: task
Status: done (2026-08-25, during delivery setup)

**Blocked by:** —

## Outcome

Done before the implementation chain was cut, and it turned out to be smaller
than written. The ticket assumed the prototype would be committed to a working
branch and then have to be deleted again. It never was — it only ever existed
as uncommitted files in the `boop-screenspace` worktree — so there was nothing
to delete.

What actually happened:

1. **Captured.** All four variants, the switcher and the `PROTOTYPE
   (screenspace)` block in `HomePage.tsx` are committed to the throwaway branch
   **`boop-screenspace-prototype`** (`ec2a461`), pushed. Not for merge.
2. **Pointer left on the spec**, beside the variants table, with the `git show`
   incantation for reading a variant without checking the branch out.
3. **Nothing to delete.** The implementation chain is cut from `origin/main`,
   which never carried the prototype. `HomePage.tsx` on the chain is the
   shipped file, untouched.

## Verify — done

- `apps/boop/src/prototype/` does not exist on the chain.
- No `protoVariant` / `PrototypeSwitcher` anywhere under `apps/boop/src`. (The
  word "prototype" does appear in a few unrelated comments — `sampleClips.ts`,
  `NewClipPicker.module.scss`, `songConductor.test.ts` — all predating this
  work and all referring to other things.)
- The branch is pushed and the pointer on the spec resolves.

## Note for ticket 03

The prototype is a **reference for the arrangement, not a source to copy from**.
It was written under prototype rules: no tests, minimal error handling, shipped
components rehoused rather than rewritten. Read it, then build it properly.
