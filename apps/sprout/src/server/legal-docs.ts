// The ToS/Privacy draft documents (ADR-0015 items 2–3): self-contained static
// HTML served from versioned app code via the D9 `registerRoutes` hook — NOT
// SPA routes, and not files in the build-output static dir (the ADR-0013
// pattern: inline styles, no external assets or scripts). Each page is a
// skeleton, not fake prose: a "Draft — not yet in force" banner, then the
// section headings from docs/legal-content-requirements.md with one-line notes
// of coverage. Counsel-approved text replaces these before launch (the
// counsel-owned launch-readiness row gates release on it).
import type { FastifyInstance } from '@hoe/backend-kit/server'

interface DocSection {
  heading: string
  note: string
}

const STYLES = `
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif;
         line-height: 1.6; color: #1a2b1e; background: #fafaf7; }
  main { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.75rem; margin: 1.5rem 0 0.5rem; }
  h2 { font-size: 1.125rem; margin: 2rem 0 0.25rem; }
  p { margin: 0.25rem 0; }
  .draft-banner { border: 2px solid #b45309; background: #fef3c7; color: #78350f;
                  border-radius: 0.5rem; padding: 1rem 1.25rem; margin-top: 2rem;
                  font-weight: 700; font-size: 1.125rem; }
  .draft-note { font-weight: 400; font-size: 0.9375rem; margin-top: 0.25rem; }
  .section-note { color: #4b5a4f; }
`

function renderDocument(title: string, sections: DocSection[]): string {
  const body = sections
    .map((s) => `<h2>${s.heading}</h2>\n<p class="section-note">${s.note}</p>`)
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — sprout</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<div class="draft-banner" role="note">Draft — not yet in force
<p class="draft-note">This page is a skeleton of the sections the final document
will contain. It is not the document itself and nothing on it is binding.</p>
</div>
<h1>${title}</h1>
${body}
</main>
</body>
</html>
`
}

// Section headings mirror the "Terms of Service — required clauses" list in
// docs/legal-content-requirements.md — one source of truth, three consumers.
export const TERMS_HTML = renderDocument('Terms of Service', [
  {
    heading: 'UK-only use',
    note: 'Will state that use of the service is restricted to the United Kingdom.',
  },
  {
    heading: 'Who may hold an account',
    note:
      'Will state that the account holder is a parent or guardian who creates and ' +
      'supervises child profiles; the child never holds the contract.',
  },
  {
    heading: 'UK residence',
    note: 'Will state that the account holder confirms they live in the UK.',
  },
  {
    heading: 'The AI is not a person',
    note:
      'Will state that the service is a chat with an AI, not a human; that it can be ' +
      'wrong; and that it is not a substitute for professional advice.',
  },
  {
    heading: 'Parental visibility',
    note:
      'Will state that parents can review their children’s conversations and receive ' +
      'safety flags.',
  },
  {
    heading: 'How agreement is captured',
    note: 'Will describe how agreement is given at registration and recorded.',
  },
  {
    heading: 'Termination and erasure',
    note: 'Will describe what happens to the account and its data when it is closed.',
  },
])

// Mirrors the "Privacy Policy — required clauses" list in the same brief.
export const PRIVACY_HTML = renderDocument('Privacy Policy', [
  {
    heading: 'What is collected',
    note:
      'Will list the data the service collects: parent account details, child profiles ' +
      'and guardrail settings, the child’s conversations, safety flags and behavioural ' +
      'events, and device tokens.',
  },
  {
    heading: 'Children’s data',
    note:
      'Will explain, prominently, how children’s conversations are processed — written ' +
      'for a parent deciding whether to allow it.',
  },
  {
    heading: 'Who processes it',
    note:
      'Will name the third-party AI providers conversations are sent to for generation ' +
      'and safety-checking, and what they receive.',
  },
  {
    heading: 'Retention windows',
    note:
      'Will state how long conversations and behavioural events are kept before they ' +
      'are pruned.',
  },
  {
    heading: 'Parental access',
    note: 'Will state that parents can see their children’s conversations and flags.',
  },
  {
    heading: 'Erasure',
    note:
      'Will describe what account deletion removes and how a parent requests deletion.',
  },
  {
    heading: 'UK-only service',
    note:
      'Will explain that data is processed on the basis that users are in the UK, and ' +
      'how that is checked.',
  },
])

/** Mount `GET /terms` and `GET /privacy` (exact paths — the geo boundary’s
 * exempt list names them the same way). */
export function registerLegalDocRoutes(app: FastifyInstance): void {
  app.get('/terms', (_req, reply) => reply.type('text/html; charset=utf-8').send(TERMS_HTML))
  app.get('/privacy', (_req, reply) => reply.type('text/html; charset=utf-8').send(PRIVACY_HTML))
}
