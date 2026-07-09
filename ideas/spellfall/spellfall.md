# Spellfall — spelling game

**App:** `apps/spellfall` (new)

## Idea

A simple education game. Words rain down from the top of the screen. Some are
spelled correctly, some are misspelled. The player clicks the **correctly
spelled** words before they reach the bottom.

## Sketch of behaviour

- Words spawn at the top and fall at a steady speed.
- Each word is either a correct spelling or a plausible misspelling.
- Click a correctly spelled word → it's cleared, score up.
- A correct word that reaches the bottom (missed) → lose a life / points.
- Clicking a misspelled word → penalty.
- Game ends after N missed words (or lives run out).

## Nice-to-haves (later)

- Difficulty ramp: faster fall speed / more words over time.
- Word lists by level or theme (age-appropriate sets).
- Score, high score, and combo streaks.
- Sound/visual feedback on hit and miss.
