'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refreshes the page at a fixed interval (in seconds).
// Only active during specified hour range (UTC).
export function AutoRefresh({
  intervalSeconds = 120,
  startHourUTC = 16,  // noon ET
  endHourUTC   = 2,   // 10pm ET (next day UTC)
}: {
  intervalSeconds?: number
  startHourUTC?: number
  endHourUTC?: number
}) {
  const router = useRouter()

  useEffect(() => {
    function isGameTime() {
      const h = new Date().getUTCHours()
      // Handle overnight range (e.g. 16–2 wraps midnight)
      if (startHourUTC <= endHourUTC) return h >= startHourUTC && h < endHourUTC
      return h >= startHourUTC || h < endHourUTC
    }

    const id = setInterval(() => {
      if (isGameTime()) router.refresh()
    }, intervalSeconds * 1000)

    return () => clearInterval(id)
  }, [router, intervalSeconds, startHourUTC, endHourUTC])

  return null
}
