'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const THRESHOLD = 72   // px of pull (after damping) needed to trigger
const DAMPING   = 0.45 // resistance factor while pulling

export function PullToRefresh() {
  const router = useRouter()
  const [pull, setPull]           = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Refs so event handlers always see current values without re-subscribing
  const startYRef     = useRef<number | null>(null)
  const pullRef       = useRef(0)
  const refreshingRef = useRef(false)

  const doRefresh = useCallback(async () => {
    refreshingRef.current = true
    setRefreshing(true)
    setPull(0)
    pullRef.current = 0
    try {
      await fetch('/api/scoring/live', { method: 'POST' })
      router.refresh()
    } catch {
      // ignore — page will still refresh on next auto-sync
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    function scrollTop(): number {
      // The layout puts overflow-y-auto on <main>; window.scrollY is usually 0
      const main = document.querySelector('main')
      return (main?.scrollTop ?? 0) + (window.scrollY ?? 0)
    }

    function onTouchStart(e: TouchEvent) {
      if (scrollTop() === 0 && !refreshingRef.current) {
        startYRef.current = e.touches[0].clientY
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startYRef.current === null || refreshingRef.current) return
      const delta = e.touches[0].clientY - startYRef.current
      if (delta > 0) {
        const damped = Math.min(delta * DAMPING, THRESHOLD + 24)
        pullRef.current = damped
        setPull(damped)
      } else {
        // Scrolling up — cancel the gesture
        startYRef.current = null
        pullRef.current = 0
        setPull(0)
      }
    }

    function onTouchEnd() {
      if (startYRef.current !== null && pullRef.current >= THRESHOLD) {
        doRefresh()
      } else {
        setPull(0)
        pullRef.current = 0
      }
      startYRef.current = null
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  }, [doRefresh])

  if (!refreshing && pull === 0) return null

  const progress = Math.min(pull / THRESHOLD, 1)

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-gray-950 border-b border-gray-800 pointer-events-none"
      style={{ height: refreshing ? 52 : pull }}
    >
      {refreshing ? (
        <div className="w-4 h-4 border-2 border-gray-700 border-t-red-400 rounded-full animate-spin" />
      ) : (
        <div
          className="text-gray-500 text-base leading-none select-none"
          style={{
            opacity: progress,
            transform: `rotate(${progress * 180}deg)`,
          }}
        >
          ↓
        </div>
      )}
    </div>
  )
}
