# 06 - Flaky test: on a phone, keyboard focus brings a shop into view

**Status:** needs-triage
**Type:** bug
**Raised:** 2026-11-17, from armoury-potions ticket 18 (the sighting is in
`.scratch/armoury-potions/issues/17-open-the-door.md`, Comments, 2026-11-16)

## What happens

`apps/armoury/src/street.iwft.tsx:84` ("on a phone, keyboard focus brings a shop
into view") failed once in a full Playwright CT run on the merged
`armoury-potions` branch (185 of 186), then passed 3 of 3 with the street suite
repeated. The test is from the swords epic and the potions epic did not change
it, though the street now has a third door. The failure's own output was not
kept.

## Not reproduced

Ticket 18 could not make it fail. On an M3 with 12 cores, all green for this
test:

- 7 full CT runs (6 workers), six of them with an instrumented copy of the test
  added six times over.
- The street suite 25 times over on 12 workers (675 tests).
- The instrumented copy 210 times on 12 workers beside 12 busy loops, and at
  20 and 100 times CPU throttle (CDP `Emulation.setCPUThrottlingRate`).

## What was learnt

- **The end state is steady and has little slack.** In every run the street
  ends at `scrollLeft` 0 with the wand shop's door at ratio 0.9991 in view; the
  test asks for 0.99. The door is 251.8 px wide at 390x844, so the test fails if
  the street rests more than about 2.3 px from 0.
- **The smooth scroll runs off the main thread.** At 100 times throttle the
  page saw `scrollLeft` 0 for 640 ms after the signpost's click, then 487 (the
  far end) in one step, then `scrollend`.
- **`StreetPom.settledScroll` takes two equal readings 120 ms apart as "at
  rest".** It cannot tell "has not started" from "has stopped". Under throttle
  it did not resolve early, because its own timer was held up with the main
  thread. It would resolve early if the page were idle while frames were held
  back for more than 120 ms (the GPU process busy, say), which CPU load alone
  did not produce here.
- **If it does resolve early, the test fails hard, as seen.** The street is
  still at 0, so the wand shop's door is wholly in view: Tab focuses it,
  `showWhole`'s `scrollIntoView({ inline: 'nearest' })` has nothing to do and so
  does not cancel the smooth scroll, the scroll then carries the door away to
  the smithy, and nothing brings it back.

This is a likely cause, not a proven one: no run showed the early reading.

## To find out

- Keep the next failure's output (the error and `error-context.md`): where the
  street rested says whether it is the early reading (it rests at the far end)
  or the 2.3 px slack (it rests near 0).
- If it is the early reading, have `showOnStreet` wait for the street's own
  `scrollend`, listened for before the click, in place of the two timed
  readings. Every caller today taps a signpost that scrolls; a tap that scrolls
  nowhere would need its own answer.

## Comments

- 2026-11-17 (armoury-potions ticket 18, fix round): the page object changed, the app did
  not. `StreetPom.showOnStreet` now reads the street's `scrollLeft` before the tap, and
  `settledScroll` waits for it to move from there before it takes two equal readings as "at
  rest", so "has not started" no longer reads as "has stopped". Shown once in a scratch test
  with the page's `scrollTo` held back 300 ms and the last look taken after the scroll had
  run: the old helper failed 3 of 3 (the door at ratio 0), the new one passed 3 of 3. The
  street suite then passed 540 of 540 (`--repeat-each=10`, twice). The sighting itself was
  never reproduced, so this stays open until the failure has not been seen again.
