'use client'

import { ErrorScreen } from '../error-screen'

export default function CalendarError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorScreen reset={reset} />
}
