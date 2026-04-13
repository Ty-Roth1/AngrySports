'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface RosterEntry {
  player_id: string
  full_name: string
  primary_position: string
}

export function PlayerClaimButton({
  leagueId,
  playerId,
  playerName,
  playerPosition,
  playerTeam,
  myTeamId,
  myRoster,
  isFaab,
  isOpenFa,
  faabRemaining,
}: {
  leagueId: string
  playerId: string
  playerName: string
  playerPosition: string
  playerTeam: string | null
  myTeamId: string
  myRoster: RosterEntry[]
  isFaab: boolean
  isOpenFa: boolean
  faabRemaining: number
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [dropPlayerId, setDropPlayerId] = useState('')
  const [bidAmount, setBidAmount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/waivers/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_add_id: playerId,
        player_drop_id: dropPlayerId || undefined,
        bid_amount: isFaab ? bidAmount : 0,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(isOpenFa ? `${playerName} added to your roster!` : `Claim submitted for ${playerName}!`)
      setOpen(false)
      startTransition(() => router.refresh())
    }
    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="inline-block px-4 py-2 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm">
        {success}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors text-white"
        >
          {isOpenFa ? 'Add to Roster' : 'Claim Player'}
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3 max-w-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              {isOpenFa ? 'Add' : 'Claim'} {playerName}
            </p>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Drop player (if roster full)</label>
            <select
              value={dropPlayerId}
              onChange={e => setDropPlayerId(e.target.value)}
              className="input text-sm w-full"
            >
              <option value="">— No drop —</option>
              {myRoster.map(r => (
                <option key={r.player_id} value={r.player_id}>
                  {r.full_name} ({r.primary_position})
                </option>
              ))}
            </select>
          </div>

          {isFaab && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                FAAB Bid — ${faabRemaining} available
              </label>
              <input
                type="number"
                min={0}
                max={faabRemaining}
                value={bidAmount}
                onChange={e => setBidAmount(Number(e.target.value))}
                className="input w-full"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-lg text-sm font-semibold transition-colors text-white"
            >
              {submitting
                ? (isOpenFa ? 'Adding…' : 'Submitting…')
                : isOpenFa
                  ? 'Add to Roster'
                  : isFaab
                    ? `Submit $${bidAmount} Claim`
                    : 'Claim Player'
              }
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
