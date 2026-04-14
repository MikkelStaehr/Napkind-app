export type Restaurant = {
  id: string
  name: string
  slug: string
  email: string
  plan: string
  created_at: string
}

export type BookingType = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  is_takeaway: boolean
  available_days: number[]
  max_party_size: number
  is_active: boolean
  created_at: string
}

export type RestaurantTable = {
  id: string
  restaurant_id: string
  table_number: number
  capacity: number
  priority: number
  is_active: boolean
  created_at: string
}

export type Booking = {
  id: string
  restaurant_id: string
  table_id: string | null
  booking_type_id: string
  guest_name: string
  guest_email: string
  guest_phone: string | null
  party_size: number
  booking_date: string
  booking_time: string
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  created_at: string
}
