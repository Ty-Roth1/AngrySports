'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function PlayerDropButton({
  leagueId,
  playerId,
  playerName,
}: {
  leagueId: string
  playerId: string
  playerName: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDrop() {
    setDropping(true)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/roster/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setDropping(false)
    } else {
      startTransition(() => router.refresh())
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-semibold transition-colors text-red-400 hover:text-red-300"
      >
        Drop Player
      </button>
    )
  }

  return (
    <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4 space-y-3 max-w-sm">
      <p className="text-sm text-white">
        Drop <span className="font-semibold">{playerName}</span>? This cannot be undone.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDrop}
          disabled={dropping}
          className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 rounded-lg text-sm font-semibold transition-colors text-white"
        >
          {dropping ? 'Dropping…' : 'Yes, Drop'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors text-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
