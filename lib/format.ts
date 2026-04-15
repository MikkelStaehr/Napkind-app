export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatTime(t: string): string {
  return t.slice(0, 5)
}

export function formatClock(d: Date): string {
  return d
    .toLocaleTimeString('da-DK', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace('.', ':')
}

export function formatDanishDate(d: Date): string {
  const s = new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
