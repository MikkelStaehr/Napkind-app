import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe, VALID_PRICE_IDS } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 })
  }

  let body: { priceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 })
  }

  const priceId = body.priceId
  if (!priceId || !VALID_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: 'Ugyldigt abonnementsvalg' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link?.restaurant_id) {
    return NextResponse.json(
      { error: 'Ingen restaurant fundet for bruger' },
      { status: 400 }
    )
  }

  const restaurantId = link.restaurant_id as string

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select('id, email, stripe_customer_id')
    .eq('id', restaurantId)
    .maybeSingle<{
      id: string
      email: string | null
      stripe_customer_id: string | null
    }>()

  if (restaurantError || !restaurant) {
    return NextResponse.json(
      { error: 'Kunne ikke indlæse restaurant' },
      { status: 500 }
    )
  }

  let customerId = restaurant.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: restaurant.email ?? user.email ?? undefined,
      metadata: { restaurant_id: restaurantId },
    })
    customerId = customer.id

    const { error: updateError } = await supabaseAdmin
      .from('restaurants')
      .update({ stripe_customer_id: customerId })
      .eq('id', restaurantId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Kunne ikke gemme Stripe-kunde' },
        { status: 500 }
      )
    }
  }

  const origin =
    request.headers.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=true`,
    cancel_url: `${origin}/upgrade`,
    metadata: { restaurant_id: restaurantId },
    subscription_data: {
      metadata: { restaurant_id: restaurantId },
    },
  })

  if (!session.url) {
    return NextResponse.json(
      { error: 'Kunne ikke oprette checkout-session' },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: session.url })
}
