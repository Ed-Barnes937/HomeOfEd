# 05 — EPIC: per-child billing / budgets

**What to build (epic — needs a spec + ticket breakdown before any build):**
Parents control spend per child; children can see what they have left.

Scope sketch from Ed:

- Parent sets a budget per child.
- Child sees their remaining budget.
- Parent sees each child's remaining budget at a glance (dashboard).
- Parent can top a budget up.
- Spending history (per child, over time).

**Blocked by:** Spec work — this file is the epic placeholder, not a buildable
ticket.

**Status:** needs-triage

**Open questions for the spec:**

- What is "spend"? OpenRouter charges per token; the pipeline currently
  doesn't meter or report usage per request. Metering has to start in
  `sprout-pipeline` (it owns the LLM call) and flow back to the web app —
  likely a usage figure on the SSE stream alongside tokens/flags.
- Currency vs. abstract credits. Real-money figures mean tracking OpenRouter's
  actual pricing per model; credits ("stars"?) are simpler, kid-legible, and
  decouple from provider price changes. Leaning matters for every UI decision.
- Exhaustion behaviour: hard stop mid-conversation, finish the current reply
  then stop, or soft warning? A hard mid-stream cut is a bad child experience;
  the session-limits banner (`children.myConfig`) is prior art for the gentle
  version.
- Does budget renew (weekly allowance) or only via manual top-up? Ed's list
  says top-up; an allowance cadence may fall out of the spec discussion.
- Interaction with session limits (`presets.sessionLimits`) — two throttles on
  the same activity need one coherent story for the child.
- Where balances live: a ledger table (top-ups + debits, balance derived) is
  the obvious durable shape and gives spending history for free.
- No real payment processing is implied — "top up" is a parent granting
  budget, not a card transaction. Confirm.

**Likely ticket shape once specced:** usage metering in the pipeline → ledger
schema + Store → budget enforcement seam in the chat path → parent UI (set /
top up / history) → child UI (remaining budget in the chat header near the
session banner).

## Comments

**2026-08-27 (Ed, pilot feedback):** Requested as an epic; expects the ticket
list above to be broken out after discussion.
