type LogLevel = 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

function emit(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    message,
  }

  if (context) entry.context = context

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else {
      entry.error = { value: String(error) }
    }
  }

  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info(message: string, context?: LogContext) {
    emit('info', message, context)
  },
  warn(message: string, context?: LogContext) {
    emit('warn', message, context)
  },
  error(message: string, error: unknown, context?: LogContext) {
    emit('error', message, context, error)
  },
}
