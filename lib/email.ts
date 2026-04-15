import { Resend } from 'resend'
import { log } from './logger'

let _resend: Resend | null = null

function getResend(): Resend | null {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  _resend = new Resend(key)
  return _resend
}

type BookingEmailInput = {
  to: string
  guestName: string
  restaurantName: string
  partySize: number
  bookingDate: string
  bookingTime: string
  notes?: string | null
}

function formatDanishDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00')
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendBookingConfirmation(
  input: BookingEmailInput
): Promise<{ sent: boolean; reason?: string }> {
  const resend = getResend()
  if (!resend) {
    log.info('email.skipped', { reason: 'no_api_key', to: input.to })
    return { sent: false, reason: 'no_api_key' }
  }

  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    log.warn('email.skipped', { reason: 'no_from_email', to: input.to })
    return { sent: false, reason: 'no_from_email' }
  }

  const date = formatDanishDate(input.bookingDate)
  const subject = `Din booking hos ${input.restaurantName} er bekræftet`
  const text = `Hej ${input.guestName}

Vi bekræfter hermed din booking hos ${input.restaurantName}.

Dato: ${date}
Tid: ${input.bookingTime}
Antal gæster: ${input.partySize}
${input.notes ? `Noter: ${input.notes}\n` : ''}
Vi glæder os til at se dig!

Med venlig hilsen
${input.restaurantName}`

  const html = `<!doctype html>
<html lang="da">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">
    <h1 style="font-size:20px;margin:0 0 16px">Din booking er bekræftet</h1>
    <p>Hej ${escapeHtml(input.guestName)}</p>
    <p>Vi bekræfter hermed din booking hos <strong>${escapeHtml(input.restaurantName)}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Dato</td><td>${escapeHtml(date)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Tid</td><td>${escapeHtml(input.bookingTime)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Antal gæster</td><td>${input.partySize}</td></tr>
      ${input.notes ? `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top">Noter</td><td>${escapeHtml(input.notes)}</td></tr>` : ''}
    </table>
    <p>Vi glæder os til at se dig!</p>
    <p style="color:#6b7280;font-size:14px">Med venlig hilsen<br/>${escapeHtml(input.restaurantName)}</p>
  </body>
</html>`

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      text,
      html,
    })

    if (error) {
      log.error('email.send_failed', error, { to: input.to, type: 'confirmation' })
      return { sent: false, reason: error.message }
    }

    log.info('email.sent', { to: input.to, type: 'confirmation', id: data?.id })
    return { sent: true }
  } catch (err) {
    log.error('email.send_threw', err, { to: input.to, type: 'confirmation' })
    return { sent: false, reason: 'exception' }
  }
}

export async function sendBookingCancellation(
  input: BookingEmailInput
): Promise<{ sent: boolean; reason?: string }> {
  const resend = getResend()
  if (!resend) {
    log.info('email.skipped', { reason: 'no_api_key', to: input.to })
    return { sent: false, reason: 'no_api_key' }
  }

  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    log.warn('email.skipped', { reason: 'no_from_email', to: input.to })
    return { sent: false, reason: 'no_from_email' }
  }

  const date = formatDanishDate(input.bookingDate)
  const subject = `Din booking hos ${input.restaurantName} er annulleret`
  const text = `Hej ${input.guestName}

Vi må desværre meddele, at din booking hos ${input.restaurantName} den ${date} kl. ${input.bookingTime} er annulleret.

Har du spørgsmål, er du velkommen til at kontakte os.

Med venlig hilsen
${input.restaurantName}`

  const html = `<!doctype html>
<html lang="da">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">
    <h1 style="font-size:20px;margin:0 0 16px">Din booking er annulleret</h1>
    <p>Hej ${escapeHtml(input.guestName)}</p>
    <p>Vi må desværre meddele, at din booking hos <strong>${escapeHtml(input.restaurantName)}</strong> den ${escapeHtml(date)} kl. ${escapeHtml(input.bookingTime)} er annulleret.</p>
    <p>Har du spørgsmål, er du velkommen til at kontakte os.</p>
    <p style="color:#6b7280;font-size:14px">Med venlig hilsen<br/>${escapeHtml(input.restaurantName)}</p>
  </body>
</html>`

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject,
      text,
      html,
    })

    if (error) {
      log.error('email.send_failed', error, { to: input.to, type: 'cancellation' })
      return { sent: false, reason: error.message }
    }

    log.info('email.sent', { to: input.to, type: 'cancellation', id: data?.id })
    return { sent: true }
  } catch (err) {
    log.error('email.send_threw', err, { to: input.to, type: 'cancellation' })
    return { sent: false, reason: 'exception' }
  }
}
