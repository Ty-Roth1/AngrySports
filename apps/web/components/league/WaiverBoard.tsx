'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ProbableStart {
  game_date: string
  opponent: string | null
  home_away: string | null
}

interface FreeAgent {
  id: string
  full_name: string
  primary_position: string
  mlb_team: string | null
  status: string
  is_rookie: boolean
  probable_starts?: ProbableStart[]
}

interface RosterPlayer {
  player_id: string
  slot_type: string
  player: { full_name: string; primary_position: string }
}

interface PendingClaim {
  id: string
  player_add_id: string
  player_drop_id: string | null
  bid_amount: number
  status: string
  process_date: string
  player: { full_name: string; primary_position: string }
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-400',
  injured: 'text-red-400',
  minors: 'text-yellow-400',
}

export function WaiverBoard({
  leagueId,
  myTeamId,
  freeAgents,
  myRoster,
  myClaims,
  isFaab,
  isOpenFa,
  faabRemaining,
  isCommissioner,
}: {
  leagueId: string
  myTeamId: string
  freeAgents: FreeAgent[]
  myRoster: RosterPlayer[]
  myClaims: PendingClaim[]
  isFaab: boolean
  isOpenFa: boolean
  faabRemaining: number
  isCommissioner: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selectedPlayer, setSelectedPlayer] = useState<FreeAgent | null>(null)
  const [dropPlayerId, setDropPlayerId] = useState<string>('')
  const [bidAmount, setBidAmount] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submitClaim() {
    if (!selectedPlayer) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await fetch(`/api/leagues/${leagueId}/waivers/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_add_id: selectedPlayer.id,
        player_drop_id: dropPlayerId || undefined,
        bid_amount: isFaab ? bidAmount : 0,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(isOpenFa ? `${selectedPlayer.full_name} added to your roster!` : `Claim submitted for ${selectedPlayer.full_name}!`)
      setSelectedPlayer(null)
      setDropPlayerId('')
      setBidAmount(1)
      startTransition(() => router.refresh())
    }
    setSubmitting(false)
  }

  async function cancelClaim(claimId: string) {
    const res = await fetch(`/api/leagues/${leagueId}/waivers/claim`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId }),
    })
    if (res.ok) startTransition(() => router.refresh())
  }

  async function processClaims() {
    setProcessing(true)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/waivers/process`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(`Processed ${data.processed} claims: ${data.won} won, ${data.lost} lost.`)
      startTransition(() => router.refresh())
    }
    setProcessing(false)
  }

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">{success}</div>
      )}

      {/* Commissioner: process claims (only for non-open leagues) */}
      {isCommissioner && !isOpenFa && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-yellow-300 text-sm">Commissioner Tools</p>
            <p className="text-xs text-yellow-600 mt-0.5">Process all pending FAAB claims due today or earlier.</p>
          </div>
          <button
            onClick={processClaims}
            disabled={processing}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors text-white"
          >
            {processing ? 'Processing…' : 'Process Waiver Claims'}
          </button>
        </div>
      )}

      {/* My pending claims */}
      {myClaims.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-sm text-white">My Pending Claims</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {myClaims.map(claim => (
              <div key={claim.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-white text-sm">{claim.player.full_name}</span>
                  <span className="text-gray-400 text-xs ml-2">{claim.player.primary_position}</span>
                  {isFaab && <span className="ml-3 text-green-400 text-sm">${claim.bid_amount}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Due {claim.process_date}</span>
                  <button
                    onClick={() => cancelClaim(claim.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Free agent list */}
        <div className="col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-sm text-white">
                Free Agents
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  {isOpenFa ? 'Click a player to add them instantly' : 'Click a player to claim'}
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
                    <th className="text-center px-3 py-2.5 w-10">#</th>
                    <th className="text-left px-5 py-2.5">Player</th>
                    <th className="text-left px-5 py-2.5">Pos</th>
                    <th className="text-left px-5 py-2.5">Team</th>
                    <th className="text-left px-5 py-2.5">Status</th>
                    <th className="text-left px-5 py-2.5">Starts</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {freeAgents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                        No free agents match your search.
                      </td>
                    </tr>
                  ) : freeAgents.map(p => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-800 last:border-0 cursor-pointer transition-colors ${
                        selectedPlayer?.id === p.id
                          ? 'bg-red-900/30 border-red-800'
                          : 'hover:bg-gray-800/40'
                      }`}
                      onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs text-gray-600 font-mono">—</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/players/${p.id}`}
                          className="font-medium text-white hover:text-red-400 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          {p.full_name}
                        </Link>
                        {p.is_rookie && <span className="ml-1 text-xs text-yellow-400">R</span>}
                      </td>
                      <td className="px-5 py-2.5 text-gray-400">{p.primary_position}</td>
                      <td className="px-5 py-2.5 text-gray-400">{p.mlb_team ?? '—'}</td>
                      <td className="px-5 py-2.5">
                        <span className={`text-xs font-medium capitalize ${STATUS_COLOR[p.status] ?? 'text-gray-400'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5">
                        {p.probable_starts && p.probable_starts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.probable_starts.map((s, i) => {
                              const isToday = s.game_date === new Date().toISOString().split('T')[0]
                              return (
                                <span
                                  key={i}
                                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    isToday ? 'bg-green-900/60 text-green-300' : 'bg-blue-900/60 text-blue-300'
                                  }`}
                                >
                                  {isToday ? 'Today' : 'Tmrw'} {s.home_away === 'home' ? 'vs' : '@'} {s.opponent}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="text-xs text-red-400">
                          {selectedPlayer?.id === p.id ? '▶ Selected' : isOpenFa ? 'Add' : 'Claim'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Claim panel */}
        <div className="col-span-1">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 sticky top-4">
            <h3 className="font-semibold text-sm text-white">{isOpenFa ? 'Add Player' : 'Claim Player'}</h3>

            {!selectedPlayer ? (
              <p className="text-xs text-gray-500">
                {isOpenFa ? 'Select a player to add them to your roster.' : 'Select a player from the list to claim them.'}
              </p>
            ) : (
              <>
                {/* Selected player */}
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
                  <p className="font-semibold text-sm text-white">{selectedPlayer.full_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedPlayer.primary_position} · {selectedPlayer.mlb_team ?? 'FA'}</p>
                </div>

                {/* Drop player */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Drop player (if roster full)</label>
                  <select
                    value={dropPlayerId}
                    onChange={e => setDropPlayerId(e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">— No drop —</option>
                    {myRoster.map(r => (
                      <option key={r.player_id} value={r.player_id}>
                        {r.player.full_name} ({r.player.primary_position})
                      </option>
                    ))}
                  </select>
                </div>

                {/* FAAB bid */}
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
                      className="input"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Remaining after bid: ${Math.max(0, faabRemaining - bidAmount)}
                    </p>
                  </div>
                )}

                <button
                  onClick={submitClaim}
                  disabled={submitting}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-lg text-sm font-semibold transition-colors text-white"
                >
                  {submitting
                    ? (isOpenFa ? 'Adding…' : 'Submitting…')
                    : isOpenFa
                      ? 'Add Player'
                      : isFaab
                        ? `Submit $${bidAmount} Claim`
                        : 'Claim Player'
                  }
                </button>

                {!isFaab && !isOpenFa && (
                  <p className="text-xs text-gray-500 text-center">
                    Non-FAAB: player is added immediately if no one else claims them.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
