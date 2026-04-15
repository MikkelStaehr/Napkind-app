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

function formatLongDate(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00')
  return new Intl.DateTimeFormat('en-GB', {
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

  const date = formatLongDate(input.bookingDate)
  const subject = `Your booking at ${input.restaurantName} is confirmed`
  const text = `Hi ${input.guestName}

We're confirming your booking at ${input.restaurantName}.

Date: ${date}
Time: ${input.bookingTime}
Party size: ${input.partySize}
${input.notes ? `Notes: ${input.notes}\n` : ''}
We look forward to seeing you!

Kind regards
${input.restaurantName}`

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">
    <h1 style="font-size:20px;margin:0 0 16px">Your booking is confirmed</h1>
    <p>Hi ${escapeHtml(input.guestName)}</p>
    <p>We're confirming your booking at <strong>${escapeHtml(input.restaurantName)}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Date</td><td>${escapeHtml(date)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Time</td><td>${escapeHtml(input.bookingTime)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Party size</td><td>${input.partySize}</td></tr>
      ${input.notes ? `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top">Notes</td><td>${escapeHtml(input.notes)}</td></tr>` : ''}
    </table>
    <p>We look forward to seeing you!</p>
    <p style="color:#6b7280;font-size:14px">Kind regards<br/>${escapeHtml(input.restaurantName)}</p>
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

  const date = formatLongDate(input.bookingDate)
  const subject = `Your booking at ${input.restaurantName} has been cancelled`
  const text = `Hi ${input.guestName}

We're sorry to let you know that your booking at ${input.restaurantName} on ${date} at ${input.bookingTime} has been cancelled.

If you have any questions, please don't hesitate to contact us.

Kind regards
${input.restaurantName}`

  const html = `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">
    <h1 style="font-size:20px;margin:0 0 16px">Your booking has been cancelled</h1>
    <p>Hi ${escapeHtml(input.guestName)}</p>
    <p>We're sorry to let you know that your booking at <strong>${escapeHtml(input.restaurantName)}</strong> on ${escapeHtml(date)} at ${escapeHtml(input.bookingTime)} has been cancelled.</p>
    <p>If you have any questions, please don't hesitate to contact us.</p>
    <p style="color:#6b7280;font-size:14px">Kind regards<br/>${escapeHtml(input.restaurantName)}</p>
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
