'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Options = {
  restaurantId: string
  tables: readonly string[]
  enabled?: boolean
  debounceMs?: number
}

export function useRealtimeRefresh({
  restaurantId,
  tables,
  enabled = true,
  debounceMs = 250,
}: Options) {
  const router = useRouter()
  const tablesKey = tables.join(',')

  useEffect(() => {
    if (!enabled || !restaurantId || tables.length === 0) return

    const supabase = createClient()
    const channelName = `rt:${restaurantId}:${tablesKey}`
    const channel = supabase.channel(channelName)

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), debounceMs)
    }

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        scheduleRefresh
      )
    }

    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [restaurantId, tablesKey, enabled, debounceMs, router, tables])
}
