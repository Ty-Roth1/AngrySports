'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function WatchlistButton({
  playerId,
  isWatched,
}: {
  playerId: string
  isWatched: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)
  const [watched, setWatched] = useState(isWatched)

  async function toggle() {
    setLoading(true)
    const res = await fetch('/api/watchlist', {
      method: watched ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })
    if (res.ok) {
      setWatched(w => !w)
      startTransition(() => router.refresh())
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        watched
          ? 'bg-yellow-600/20 border border-yellow-600 text-yellow-400 hover:bg-yellow-600/30'
          : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-yellow-400 hover:border-yellow-600 transition-colors'
      }`}
    >
      <span>{watched ? '★' : '☆'}</span>
      <span>{watched ? 'Watching' : 'Watch'}</span>
    </button>
  )
}
