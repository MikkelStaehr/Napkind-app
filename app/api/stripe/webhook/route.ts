import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'

/*
 * Required schema addition (run once in Supabase SQL editor):
 *
 * ALTER TABLE restaurants
 *   ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
 */

export const runtime = 'nodejs'

type StripeSubStatus = Stripe.Subscription.Status

function mapStatus(s: StripeSubStatus): string {
  if (s === 'active' || s === 'trialing') return 'active'
  if (s === 'past_due' || s === 'unpaid') return 'past_due'
  if (s === 'canceled' || s === 'incomplete_expired') return 'cancelled'
  return s
}

async function findRestaurantId(params: {
  metadataRestaurantId?: string | null
  customerId?: string | null
}): Promise<string | null> {
  if (params.metadataRestaurantId) return params.metadataRestaurantId

  if (params.customerId) {
    const { data } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('stripe_customer_id', params.customerId)
      .maybeSingle<{ id: string }>()
    return data?.id ?? null
  }

  return null
}

async function handleSubscription(
  subscription: Stripe.Subscription,
  statusOverride?: string
) {
  const metaRestaurantId = (subscription.metadata as Record<string, string> | null)
    ?.restaurant_id

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null

  const restaurantId = await findRestaurantId({
    metadataRestaurantId: metaRestaurantId,
    customerId,
  })

  if (!restaurantId) {
    console.error('[stripe webhook] Kunne ikke finde restaurant for subscription', subscription.id)
    return
  }

  const s = subscription as unknown as {
    current_period_end?: number
    items?: { data?: Array<{ current_period_end?: number }> }
  }
  const periodEnd = s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null
  const periodEndsAt =
    typeof periodEnd === 'number' ? new Date(periodEnd * 1000).toISOString() : null

  const { error } = await supabaseAdmin
    .from('restaurants')
    .update({
      subscription_status: statusOverride ?? mapStatus(subscription.status),
      stripe_subscription_id: subscription.id,
      current_period_ends_at: periodEndsAt,
    })
    .eq('id', restaurantId)

  if (error) {
    console.error('[stripe webhook] Kunne ikke opdatere restaurant:', error.message)
  }
}

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subId, {
            expand: ['items.data.price'],
          })
          await handleSubscription(subscription, 'active')
        }
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscription(sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscription(sub, 'cancelled')
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
