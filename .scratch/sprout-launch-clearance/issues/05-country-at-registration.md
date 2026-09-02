# How country is captured and stored at parent registration

Type: grilling
Status: resolved
Blocked by: —

## Question

ADR-0008 measure 2: "country at parent registration — UK-only, with ToS restricting use to the
UK." `ParentRegisterPage.tsx` currently collects name, email, password and nothing else.

Points to resolve:

- **Shape of the input.** A country `<select>` that only accepts the UK (and rejects everything
  else) is more honest data; a single "I confirm I live in the UK" checkbox is a clearer
  attestation and less to build. Which is the measure — captured *fact* or captured *claim*?
  The legal value is arguably in the attestation.
- **Where it's stored.** Better Auth `additionalFields` on the `user` table, or a sprout-owned
  column? Note `schema.ts` holds all 13 tables including the Better Auth ones, so either way
  it's a migration — and `apps/sprout/src/server/migrations/` is committed drizzle-kit output,
  so the migration is a real artifact.
- **Is it retained as evidence?** If the point is to be able to show counsel that every account
  attested to being UK-based, it must survive; that interacts with the erasure cascade
  (`children.parentId` → `user.id` is `onDelete: cascade`) and with the retention worker. Flag
  the tension; the fog note on retention is downstream of this answer.
- **What happens on conflict** between the attestation and the geo signal (a UK attestation from
  a German IP)? Block, allow, or flag? A flag is cheap and the flags pipeline already exists.
- **Existing accounts.** Is there any account already in the DB that predates the field? If the
  app has never been deployed, the answer is "no" and the migration needs no backfill — confirm
  rather than assume, since it decides whether the column is nullable.

**Recommendation to react to:** a required attestation checkbox (not a country picker — a
picker with one option is theatre), stored as a Better Auth additional field with a timestamp,
retained, and a mismatch against the geo signal recorded as a flag rather than a block.

## Answer

Recorded as **ADR-0014** in `apps/sprout/docs/product-legal-adrs.md`, counsel-flagged.

- **Shape: attestation, worded as residence.** A required checkbox — proposed copy *"I
  confirm I live in the United Kingdom"* (label copy itself counsel-flagged). Not a country
  picker: ADR-0012's gate already proves **presence** (non-GB requests never reach Better
  Auth), so the picker would capture nothing; **residence** is the claim only an attestation
  captures, and it's what the ToS restriction is about.
- **Storage: Better Auth `additionalField` on `user`**, following the `subscriptionStatus`
  precedent — `uk_residence_attested_at timestamptz NOT NULL`, committed drizzle-kit
  migration. App never deployed ⇒ no accounts predate the field ⇒ no backfill, `NOT NULL`
  safe (confirmed, not assumed).
- **Server check is load-bearing.** A `databaseHooks.user.create.before` hook rejects any
  signup without a true attestation in the payload and stamps the column with **server**
  time. The form checkbox is UX; the hook is the testable, versioned control (ADR-0011
  logic applied again).
- **Not retained as evidence: erased with the account.** Post-erasure retention of
  identity-linked data needs its own lawful basis; on a children's product the bias runs
  toward erasure-means-erasure. The mechanism (hook + tests + migration + ADR) is the
  evidence that every existing account attested. Knowing choice, counsel-flagged; an
  erasure-log is a possible follow-up if counsel wants one. `Store.deleteUser` exists but
  no handler exposes it — erasure is an operator action today. **This also resolves the
  map's retention fog note.**
- **Conflict handling: none.** Structurally precluded — the geo gate runs upstream of
  registration; the `.fly.dev` spoofing residual is already accepted (ADR-0011). The
  ticket's "a flag is cheap" premise was false: `flags.childId` is `NOT NULL` (child-scoped),
  and no child exists at parent registration. `CF-IPCountry` is not stored — it would always
  read `GB`. The VPN case defeats geo and attestation alike; the attestation existing is the
  reasonable-measures answer.

**Build handed to `/tdd`** (migration + additionalField + before-create hook + form
checkbox). Ticket 06 (ToS/consent gate) shares the registration form and should reference
ADR-0014; nothing blocks it.
