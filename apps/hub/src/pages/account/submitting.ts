import type { FormEvent } from 'react'

export function submitting(run: () => void): (event: FormEvent) => void {
  return (event) => {
    event.preventDefault()
    run()
  }
}
