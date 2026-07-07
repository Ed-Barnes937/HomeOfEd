import { describe, expect, it } from 'vitest'

import { voteOutputOpinions, type Opinion } from './opinion-vote.ts'

const safe = (source: Opinion['source']): Opinion => ({
  source,
  safe: true,
  reason: 'ok',
})

describe('three-opinion vote (6.5.2, ADR-0003)', () => {
  it('releases the output only when all three opinions agree it is safe', () => {
    const result = voteOutputOpinions([safe('judge'), safe('llama-guard'), safe('lexical')])
    expect(result.safe).toBe(true)
    expect(result.dissenting).toEqual([])
  })

  it('blocks a reply the judge passes but a classifier flags (the core scenario)', () => {
    const result = voteOutputOpinions([
      safe('judge'), // R5 judge would let it through
      { source: 'lexical', safe: false, reason: 'self-harm' }, // R4 disagrees
      safe('llama-guard'),
    ])
    expect(result.safe).toBe(false)
    expect(result.dissenting.map((o) => o.source)).toEqual(['lexical'])
    expect(result.reason).toContain('lexical: self-harm')
  })

  it('blocks when Llama Guard dissents alone', () => {
    const result = voteOutputOpinions([
      safe('judge'),
      { source: 'llama-guard', safe: false, reason: 'S11' },
      safe('lexical'),
    ])
    expect(result.safe).toBe(false)
    expect(result.reason).toContain('llama-guard: S11')
  })

  it('any disagreement is unsafe — surfaces every dissenting opinion', () => {
    const result = voteOutputOpinions([
      { source: 'judge', safe: false, reason: 'inappropriate' },
      { source: 'llama-guard', safe: false, reason: 'S1' },
      safe('lexical'),
    ])
    expect(result.safe).toBe(false)
    expect(result.dissenting).toHaveLength(2)
  })
})
