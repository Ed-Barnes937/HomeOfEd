import { describe, expect, it } from 'vitest'

import { decideChatThrottle, decidePinLock, type BehaviouralLimits } from './behavioural-limits.ts'

const limits: BehaviouralLimits = {
  velocityWindowSeconds: 60,
  maxMessagesPerWindow: 20,
  probeWindowSeconds: 300,
  maxProbesPerWindow: 4,
  reputationWindowSeconds: 3600,
  deviceProbeStrikeLimit: 8,
  pinWindowSeconds: 900,
  maxPinFailures: 5,
  retentionSeconds: 86400,
}

const noCounts = {
  messageCount: 0,
  sessionProbeCount: 0,
  deviceProbeCount: 0,
}

describe('decideChatThrottle', () => {
  it('allows traffic below every threshold', () => {
    expect(
      decideChatThrottle(
        { messageCount: 19, sessionProbeCount: 3, deviceProbeCount: 7 },
        limits,
      ),
    ).toEqual({ throttled: false })
  })

  it('throttles on session velocity at the limit', () => {
    const verdict = decideChatThrottle({ ...noCounts, messageCount: 20 }, limits)
    expect(verdict.throttled).toBe(true)
    if (verdict.throttled) {
      expect(verdict.reason).toBe('rate')
      expect(verdict.retryAfterSeconds).toBe(60)
    }
  })

  it('throttles repeated probing by a single child', () => {
    const verdict = decideChatThrottle({ ...noCounts, sessionProbeCount: 4 }, limits)
    expect(verdict.throttled).toBe(true)
    if (verdict.throttled) expect(verdict.reason).toBe('probe')
  })

  it('throttles a low-reputation device', () => {
    const verdict = decideChatThrottle({ ...noCounts, deviceProbeCount: 8 }, limits)
    expect(verdict.throttled).toBe(true)
    if (verdict.throttled) expect(verdict.reason).toBe('reputation')
  })

  it('prioritises the velocity reason when several limits trip at once', () => {
    const verdict = decideChatThrottle(
      { messageCount: 20, sessionProbeCount: 4, deviceProbeCount: 8 },
      limits,
    )
    expect(verdict.throttled).toBe(true)
    if (verdict.throttled) expect(verdict.reason).toBe('rate')
  })
})

describe('decidePinLock', () => {
  it('allows attempts below the failure limit', () => {
    expect(decidePinLock(4, limits)).toEqual({ locked: false })
  })

  it('locks out at the failure limit', () => {
    expect(decidePinLock(5, limits)).toEqual({
      locked: true,
      retryAfterSeconds: 900,
    })
  })
})
