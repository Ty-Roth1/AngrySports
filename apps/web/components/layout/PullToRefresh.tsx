'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const THRESHOLD = 65   // px of pull needed to trigger refresh
const DAMPEN   = 0.45  // resistance factor — makes pull feel natural

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(-1)
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current
    // Only start tracking if we're at the top of the scroll container
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current < 0 || refreshing) return
    const diff = e.touches[0].clientY - startY.current
    if (diff > 0) setDistance(Math.min(diff * DAMPEN, 90))
    else setDistance(0)
  }, [refreshing])

  const onTouchEnd = useCallback(async () => {
    if (startY.current < 0) return
    startY.current = -1
    if (distance >= THRESHOLD) {
      setRefreshing(true)
      try {
        await fetch('/api/scoring/live', { method: 'POST' })
      } catch { /* ignore — still refresh */ }
      router.refresh()
      setTimeout(() => {
        setRefreshing(false)
        setDistance(0)
      }, 1200)
    } else {
      setDistance(0)
    }
  }, [distance, router])

  const showIndicator = distance > 4 || refreshing

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-6 pb-nav-safe md:pb-6 relative"
      style={{ overscrollBehaviorY: 'none' }}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{
          top: showIndicator ? `${distance - 32}px` : '-40px',
          transition: refreshing ? 'none' : 'top 0.15s ease-out',
        }}
      >
        <div className={`w-8 h-8 rounded-full bg-gray-800 border border-gray-700 shadow-lg flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      </div>

      {children}
    </div>
  )
}
