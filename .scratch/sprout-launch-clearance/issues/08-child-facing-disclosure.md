# The child-facing honest disclosure

Type: prototype
Status: resolved
Blocked by: —

## Question

6.5.9's "honest disclosure" half. The **parent**-facing disclosure exists — `FlagsPage.tsx`
carries a "What this can and can't do" block. Whether a **child** is ever told they're talking
to a computer rather than a person is unverified, and it's the more important of the two.

This wants a rough artifact to react to, via `/prototype` — wording for children is not
something to settle in the abstract.

Points to resolve:

- **Does it exist at all today?** Check the child chat pages (`ChatNewPage`,
  `ChatContinuePage`, `ChildHomePage`) before designing anything new.
- **Placement.** First-run only, persistent in the chat header, on every session start, or in
  the empty state before the first message? Persistent is honest but becomes wallpaper; once-only
  is missable and a child may not have been the one who saw it.
- **Wording, for a child who may be an early reader.** "I'm a computer, not a person" is
  concrete and true. Avoid anything that sounds like a legal notice — a disclosure a child can't
  read isn't a disclosure.
- **Does the AI itself hold the line in conversation?** If a child asks "are you a real person",
  the answer has to be honest. Check whether the system prompt covers it, and whether that's
  part of this decision or a separate one.
- Interaction with the map's fog note on **per-preset variants** — reading age differs sharply
  between `early-learner` and `independent-explorer`. Decide whether one wording serves all
  three or the fog graduates into its own ticket.

Link the prototype from this ticket as an asset.

**Recommendation to react to:** a persistent, small, plain line in the chat surface plus an
explicit first-run statement, with the system prompt required to answer honestly when asked
directly — because that's the moment a child actually wants to know.

## Comments

**Verified facts (this session, before prototyping):**

- **No child-facing disclosure exists anywhere today.** `ChatNewPage`, `ChatContinuePage`,
  `ChildHomePage`, `ChildLoginPage`, `ChatTranscript`, `ChatInput` — none carry one. Worse,
  the new-chat empty state says "Ask me anything! I'm here to help you learn." — first person
  with no statement of what "I" is.
- **The system prompt holds a *negative* line only.** `ABSOLUTE_BLOCKERS` in
  `apps/sprout-pipeline/src/prompt.ts` includes "You must NEVER pretend to be a real person
  or claim to be human" — always present, all presets. But there is no *positive* instruction
  to plainly say "I'm a computer" when a child asks "are you a real person"; the model could
  technically comply by deflecting. Whether to add a positive honesty-about-identity
  instruction is part of this decision (it's one sentence in the same prompt module).
- **Reading-age spread is real:** vocabulary slider 1 targets reading age 5–7;
  `independent-explorer` gets full natural vocabulary. The prototype carries a preset toggle
  so the one-wording-or-three question can be judged directly.

**Prototype:** [`assets/child-disclosure-prototype.html`](../assets/child-disclosure-prototype.html)
— a static facsimile of the chat surface (real tokens/layout/copy), three structural variants:

- **A** — persistent line in the chat header (chrome voice, third person).
- **B** — Sprout introduces itself as the first bubble of every new conversation (AI voice).
- **C** — first-run statement card in the empty state + small persistent line above the input
  (the ticket's recommendation).

Toggles: empty vs mid-conversation (tests the wallpaper / scroll-away failure modes), preset
(wording register), and an optional "your grown-up can see your chats" sentence — the parent
visibility half of 6.5.9 is honest to disclose to the child too, but it's optional pending
reaction. ←/→ switch variants. Open directly in a browser; no server needed.

## Answer

Recorded as **ADR-0017** in `apps/sprout/docs/product-legal-adrs.md`, counsel-flagged
(child-facing copy + the monitoring-disclosure framing). The human reacted to the prototype
([`assets/child-disclosure-prototype.html`](../assets/child-disclosure-prototype.html)) and
chose **variant C, with the "grown-ups can see" sentence kept**.

- **Does it exist today? No — verified absent everywhere.** No child surface discloses that
  Sprout is a computer; the empty state speaks in first person without saying what "I" is.
- **Placement:** first-run statement card (replaces the new-chat empty state) **plus** a
  small persistent line above the chat input on every chat screen. Card = explicit statement
  at the start; line = survives mid-conversation without becoming header wallpaper.
- **Wording: per-preset register, one voice, three reading levels** — full copy table in
  ADR-0017. Resolves the map's per-preset fog note inside this decision; no new ticket.
- **Parent-visibility sentence stays in.** Verified code-true at every `parentVisibility`
  setting (parents get full read unconditionally; the slider's "Summaries & flags only" low
  end is not enforced anywhere — recorded in the ADR as an observed gap; wording chosen to
  stay true under either regime).
- **System prompt:** part of this decision — `prompt.ts` gains a *positive* identity
  instruction (answer plainly "I'm a computer program, not a person" when asked) alongside
  the existing negative ABSOLUTE_BLOCKERS line.
- **Build handed to `/tdd`** (SPA card + line keyed off `children.myConfig`'s preset;
  pipeline prompt sentence + test). Roadmap 6.5.9 updated to cite ADR-0017.
