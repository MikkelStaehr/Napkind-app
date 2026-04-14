'use client'

import { ErrorScreen } from '../error-screen'

export default function SettingsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorScreen reset={reset} />
}
