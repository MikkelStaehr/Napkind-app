import { supabaseAdmin } from './supabase/admin'

export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'past_due'
export type SubscriptionTier = 'free' | 'premium'

export type SubscriptionInfo = {
  subscription_status: SubscriptionStatus | null
  subscription_tier: SubscriptionTier | null
  current_period_ends_at: string | null
}

export async function getSubscriptionStatus(
  restaurantId: string
): Promise<SubscriptionInfo | null> {
  const { data } = await supabaseAdmin
    .from('restaurants')
    .select('subscription_status, subscription_tier, current_period_ends_at')
    .eq('id', restaurantId)
    .maybeSingle()

  return (data as SubscriptionInfo | null) ?? null
}

export function isSubscriptionActive(sub: SubscriptionInfo | null): boolean {
  if (!sub) return false
  if (sub.subscription_status !== 'active') return false
  if (!sub.current_period_ends_at) return false
  return new Date(sub.current_period_ends_at).getTime() > Date.now()
}

export async function getRestaurantIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', userId)
    .maybeSingle()

  return (data?.restaurant_id as string | undefined) ?? null
}
