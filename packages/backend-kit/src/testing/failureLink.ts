// Test-only failure injection, applied as a @trpc/client link. Exported via
// the '@hoe/backend-kit/testing' subpath so it can never be pulled into a
// prod bundle by accident. The FailureRule shape is frozen (T1.1) — this
// file implements it and must not change it.
import { TRPCClientError, type TRPCLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { observable, type Unsubscribable } from '@trpc/server/observable'

import type { FailureRule } from '../failures.ts'

/**
 * Match calls by procedure path (e.g. 'notes.get') and inject a failure:
 *
 * - `error`   — the call fails with a TRPCClientError (no request is made).
 * - `latency` — wait `ms` (default 0), then pass the call through unchanged.
 * - `network` — the call fails the way a dead network fails: a
 *               TRPCClientError caused by a fetch-style TypeError, with no
 *               response `data`.
 *
 * First matching rule wins; unmatched calls pass straight through.
 */
export function failureLink(rules: readonly FailureRule[]): TRPCLink<AnyTRPCRouter> {
  return () =>
    ({ next, op }) => {
      const rule = rules.find((r) => r.path === op.path)
      if (!rule) return next(op)

      if (rule.mode === 'error') {
        return observable((observer) => {
          observer.error(new TRPCClientError(`failureLink: injected error for '${op.path}'`))
        })
      }

      if (rule.mode === 'network') {
        return observable((observer) => {
          observer.error(TRPCClientError.from(new TypeError('fetch failed')))
        })
      }

      // latency: delay, then forward to the terminating link
      return observable((observer) => {
        let subscription: Unsubscribable | undefined
        const timer = setTimeout(() => {
          subscription = next(op).subscribe(observer)
        }, rule.ms ?? 0)
        return () => {
          clearTimeout(timer)
          subscription?.unsubscribe()
        }
      })
    }
}
