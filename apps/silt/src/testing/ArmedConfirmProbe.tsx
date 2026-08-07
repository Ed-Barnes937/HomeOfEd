import { useArmedConfirm } from '../hooks/useArmedConfirm.ts'

/** Test-only harness for useArmedConfirm — exercised by useArmedConfirm.iwft.tsx. */
export function ArmedConfirmProbe({ ms }: { ms: number }) {
  const { armed, arm, disarm } = useArmedConfirm<string>(ms)
  return (
    <div>
      <span data-testid="armed">{armed ?? 'none'}</span>
      <button type="button" data-testid="arm-a" onClick={() => arm('a')}>
        arm a
      </button>
      <button type="button" data-testid="arm-b" onClick={() => arm('b')}>
        arm b
      </button>
      <button type="button" data-testid="disarm" onClick={() => disarm()}>
        disarm
      </button>
    </div>
  )
}
