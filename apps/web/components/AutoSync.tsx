'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Triggers a live scoring sync then refreshes the page at a fixed interval.
// Only runs during game hours (17:00–07:00 UTC = 10am–midnight PT).
// Meant to complement the Vercel cron (which has a 1-minute minimum) by
// giving near-real-time score updates while someone is actively viewing.
export function AutoSync({ intervalSeconds = 60 }: { intervalSeconds?: number }) {
  const router = useRouter()
  const running = useRef(false)

  useEffect(() => {
    async function syncAndRefresh() {
      if (running.current) return
      running.current = true
      try {
        await fetch('/api/scoring/live', { method: 'POST' })
        router.refresh()
      } catch {
        // ignore network errors — next tick will retry
      } finally {
        running.current = false
      }
    }

    function isGameTime() {
      const h = new Date().getUTCHours()
      // 17:00–23:59 UTC (10am–4pm PT) or 00:00–06:59 UTC (4pm–11pm PT)
      return h >= 17 || h < 7
    }

    const id = setInterval(() => {
      if (isGameTime()) syncAndRefresh()
    }, intervalSeconds * 1000)

    return () => clearInterval(id)
  }, [router, intervalSeconds])

  return null
}
