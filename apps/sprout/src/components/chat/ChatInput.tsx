// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import type { FormEvent, ReactNode } from 'react'

import { Button } from '../ui/button.tsx'
import { Input } from '../ui/input.tsx'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  canSubmit: boolean
  extraAction?: ReactNode
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  canSubmit,
  extraAction,
}: ChatInputProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="border-border border-t px-4 py-3">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type a message..."
          disabled={disabled}
          autoFocus
        />
        {extraAction}
        <Button type="submit" disabled={disabled || !canSubmit}>
          Send
        </Button>
      </form>
    </div>
  )
}
