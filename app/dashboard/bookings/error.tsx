'use client'

import { ErrorScreen } from '../error-screen'

export default function BookingsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorScreen reset={reset} />
}
