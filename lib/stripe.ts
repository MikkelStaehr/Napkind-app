import Stripe from 'stripe'

let _stripe: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY
      if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not set')
      }
      _stripe = new Stripe(key)
    }
    return Reflect.get(_stripe, prop, _stripe)
  },
})

export const PLANS = {
  monthly: {
    priceId: 'price_1TM2QvPY8Mt5hhgf9ZAJCiLS',
    name: 'Monthly',
    amount: 149,
    interval: 'month' as const,
  },
  yearly: {
    priceId: 'price_1TM2QbPY8Mt5hhgfHY5g3loT',
    name: 'Yearly',
    amount: 999,
    interval: 'year' as const,
  },
} as const

export const VALID_PRICE_IDS: ReadonlySet<string> = new Set([
  PLANS.monthly.priceId,
  PLANS.yearly.priceId,
])
