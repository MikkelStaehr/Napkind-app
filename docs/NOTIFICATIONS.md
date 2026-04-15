# Notifikations-arkitektur

Plan for pluggable email/SMS-providers i Napkind-app, så den spejler WP-pluginens mønster. Skrevet som handover-dokument til videre arbejde.

## Baggrund

WP-pluginen ([includes/class-notifications.php](../../WP-Plugin/includes/class-notifications.php)) har allerede en velfungerende provider-arkitektur:

- **Email**: Resend, Brevo, eller generisk webhook (kundens egen URL)
- **SMS**: Twilio, GatewayAPI, eller webhook
- **To recipients**: `notify_restaurant` + `notify_guest` som separate checkboxes
- **Settings** gemmes per-restaurant i `wp_options`
- **Admin UI** viser/skjuler API-key-felter baseret på valgt provider

Webhook-fallback er nøglen — kunder med eksisterende Mailgun/SMTP/andet kan bare pege Napkind på deres egen URL.

## Nuværende tilstand (skal refaktoreres)

[lib/email.ts](../lib/email.ts) er hardkodet til Resend. Kaldes fra [app/dashboard/bookings/actions.ts](../app/dashboard/bookings/actions.ts) i `updateBookingStatus` via `notifyGuestAboutStatusChange`. Skal rykkes ind under provider-pattern.

## Målarkitektur

```
lib/notifications/
├── dispatch.ts           # henter config, vælger provider, sender
├── providers/
│   ├── resend.ts
│   ├── brevo.ts
│   ├── webhook.ts        # POST hele payload til kundens URL
│   └── types.ts          # fælles EmailProvider interface
├── sms/                  # samme mønster når SMS skal ind
└── templates.ts          # delt body/subject for alle providers
```

### Provider-interface (forslag)

```typescript
// lib/notifications/providers/types.ts
export type EmailPayload = {
  to: string
  from: string
  subject: string
  text: string
  html: string
}

export type SendResult = { sent: boolean; id?: string; reason?: string }

export interface EmailProvider {
  send(payload: EmailPayload): Promise<SendResult>
}
```

### Dispatcher-flow

1. Server action trigger (fx `updateBookingStatus` → 'confirmed')
2. Dispatcher henter `restaurant_notification_settings` for restaurant
3. Bygger template fra booking-data + event type
4. For hver recipient (guest, restaurant) → vælg provider → send
5. Logger hver levering via `lib/logger.ts`

## Ny Supabase-tabel

```sql
create table restaurant_notification_settings (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,

  email_provider text check (email_provider in ('resend','brevo','webhook','none')) default 'none',
  email_api_key text,            -- plain text i første version; kryptering senere
  email_from text,               -- e.g. "noreply@restaurant.dk"
  email_webhook_url text,        -- kun når provider = 'webhook'

  sms_provider text check (sms_provider in ('twilio','gatewayapi','webhook','none')) default 'none',
  sms_api_key text,
  sms_from text,                 -- afsender-navn eller Twilio-nr
  sms_webhook_url text,

  notify_restaurant boolean default true,
  notify_guest boolean default true,

  updated_at timestamptz default now()
);

alter table restaurant_notification_settings enable row level security;

-- Kun ejer af restauranten kan læse/skrive settings
create policy "Bruger kan se egne notification settings"
on restaurant_notification_settings for select
using (restaurant_id in (select get_my_restaurant_ids()));

create policy "Bruger kan opdatere egne notification settings"
on restaurant_notification_settings for update
using (restaurant_id in (select get_my_restaurant_ids()));

create policy "Bruger kan oprette egne notification settings"
on restaurant_notification_settings for insert
with check (restaurant_id in (select get_my_restaurant_ids()));
```

## Settings-UI

Tilføj ny fane eller side: `/dashboard/settings/notifications`.

UX matcher WP-admin-siden:

- Radio-gruppe: Email provider (Resend / Brevo / Webhook / Ingen)
- Betinget felt: API-key (kun synlig når Resend eller Brevo)
- Betinget felt: Webhook URL (kun synlig når 'webhook')
- Fra-adresse
- Checkboxes: "Send bekræftelse til gæst" + "Send besked til restaurant"
- Samme blok for SMS

Kodepattern: radio + `data-napkind-show-for`-stil conditional visibility. Se [admin/settings.php:324-352](../../WP-Plugin/admin/settings.php) som reference.

## Async levering

**Nu (MVP)**: Brug Next.js' indbyggede `after()` i server actions — fire-and-forget efter response er sendt tilbage. Ingen queue-infrastruktur nødvendig.

```typescript
import { after } from 'next/server'

export async function updateBookingStatus(...) {
  // ... update booking
  after(() => dispatchNotifications(bookingId, 'confirmed'))
  revalidatePath('/dashboard/bookings')
}
```

**Senere** (hvis volumen eller reliability kræver det): Løft til Inngest, Trigger.dev, eller Supabase Edge Function triggered på DB insert.

## Events der trigger notifikationer

Minimum til at starte:

- `booking.created` (fra WP-plugin gæst-flow) — bekræftelse til gæst + heads-up til restaurant
- `booking.confirmed` — bekræftelse til gæst
- `booking.cancelled` — annullerings-mail til gæst

Senere: reminder 24h før, no-show detection, etc.

## Åbne spørgsmål

1. **Kryptering af API-keys**: Første version plain text i DB. Senere migration til pgsodium eller Supabase Vault.
2. **Rate limiting**: Hvad hvis en provider throttler os? Retry-logik i webhook-provider?
3. **Template-customization**: Skal restauranter kunne redigere email-templates, eller er de faste dansk-sprogede?
4. **Delte settings mellem WP og app**: Hvis samme Supabase-projekt, skal WP-pluginen læse fra `restaurant_notification_settings` i stedet for `wp_options`? Så undgår kunderne at konfigurere dobbelt. Kræver ændring i WP-pluginen.

## Implementation checklist

- [ ] Kør SQL for `restaurant_notification_settings`-tabel
- [ ] `lib/notifications/providers/types.ts` med interface
- [ ] `lib/notifications/providers/resend.ts` (migrér fra nuværende `lib/email.ts`)
- [ ] `lib/notifications/providers/brevo.ts`
- [ ] `lib/notifications/providers/webhook.ts`
- [ ] `lib/notifications/templates.ts` (flyt HTML/text-templates fra nuværende `lib/email.ts`)
- [ ] `lib/notifications/dispatch.ts` (læs settings, vælg provider, send til guest/restaurant)
- [ ] Refaktor [app/dashboard/bookings/actions.ts](../app/dashboard/bookings/actions.ts) til at kalde dispatcher i stedet for `sendBookingConfirmation`/`sendBookingCancellation` direkte
- [ ] Slet `lib/email.ts` når alt er migreret
- [ ] `/dashboard/settings/notifications` page + client component
- [ ] Server action til at gemme settings
- [ ] Test ende-til-ende med Resend først, så Brevo, så webhook
- [ ] Gentag for SMS-providers
