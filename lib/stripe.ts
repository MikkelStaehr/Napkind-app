import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const PLANS = {
  monthly: {
    priceId: 'price_1TM1jWPb9akb1LSwjWPH5p25',
    name: 'Månedlig',
    amount: 149,
    interval: 'month' as const,
  },
  yearly: {
    priceId: 'price_1TM1joPb9akb1LSwZQtMVZcK',
    name: 'Årlig',
    amount: 999,
    interval: 'year' as const,
  },
} as const

export const VALID_PRICE_IDS: ReadonlySet<string> = new Set([
  PLANS.monthly.priceId,
  PLANS.yearly.priceId,
])
