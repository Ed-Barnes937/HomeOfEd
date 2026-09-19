# keybloom - the garden your keyboard grows

**The toy.** A bare windowsill planter and a gentle stream of words drifting
by like seeds on the wind. Type a word before it floats away and it lands in
the soil and *grows* - each keystroke a leaf unfurling, a clean word a flower.
Mistyped letters just fall as petals; nothing dies, nothing beeps. Sessions
end with a planter that looks like your typing: fast accurate spells make
tall lupins, hesitant hunt-and-peck makes charming moss.

**The play loop.** The garden is a portrait of the session. The pull is
purely aesthetic - "today I want to fill the window with foxgloves" - and
foxgloves happen to demand longer words typed cleanly.

**The stealth payload.** Touch typing. The word stream is quietly a
curriculum: home-row words first, then reaches, then punctuation, advancing
only on demonstrated comfort, never announced. Typing is the highest-leverage
unglamorous skill a home-educated kid can pick up early, and every existing
typing tutor looks like homework - that is the entire gap this fills.

**Stealth discipline.** No WPM, no accuracy percentage, no streaks - the
flowers *are* the feedback. A parent-facing corner of localStorage can keep
the real metrics for the grown-up who wants to peek.

**Prior art.** Every typing tutor (as the anti-pattern); flOw and A Short
Hike for effortless difficulty ramps; boop's no-fail sound-toy stance.

**Shape.** Stateless, single screen, keyboard-first (a desktop-first app, and
that is fine - typing is a desktop skill). Pure-TS engines for the word-
curriculum ladder and the growth grammar (keystroke events in, plant geometry
out); canvas renderer. Progress in localStorage.

**Open questions.** Whether word difficulty adapts per-finger (weak right
pinky gets more `p` words) or stays coarse; what the phone experience is, if
any (probably a "visit your garden" viewer, no typing).
