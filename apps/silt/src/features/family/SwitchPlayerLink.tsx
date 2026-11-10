import { switchPlayerUrlFor } from '@hoe/accounts'

import { useFamilySession } from './FamilySessionContext.tsx'

interface SwitchPlayerLinkProps {
  className?: string
}

/** Who is playing, as a link to pick someone else at hub (spec decision 10). None outside the estate. */
export function SwitchPlayerLink({ className }: SwitchPlayerLinkProps) {
  const name = useFamilySession()?.name ?? null
  const href = switchPlayerUrlFor(window.location.href)
  if (href === null) return null
  return (
    <a
      className={className}
      href={href}
      data-testid="switch-player"
      aria-label={name === null ? 'switch player' : `switch player, playing as ${name}`}
    >
      {name ?? 'switch player'}
    </a>
  )
}
