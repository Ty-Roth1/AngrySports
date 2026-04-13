'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ProbableStart {
  game_date: string
  opponent: string | null
  home_away: string | null
}

interface PlayerRow {
  id: string
  full_name: string
  primary_position: string
  mlb_team: string | null
  status: string
  is_rookie: boolean
  rank: number | null
  season_pts: number | null
  probable_starts?: ProbableStart[]
  owned_by?: { id: string; name: string; abbreviation: string } | null
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
  active:   'text-green-400',
  IL10:     'text-orange-400',
  IL60:     'text-red-400',
  inactive: 'text-gray-500',
  minors:   'text-yellow-400',
}

const STATUS_LABEL: Record<string, string> = {
  active:   'Active',
  IL10:     'IL-10',
  IL60:     'IL-60',
  inactive: 'Inactive',
  minors:   'Minors',
}

export function PlayerBoard({
  leagueId,
  myTeamId,
  players,
  view,
  myRoster,
  myClaims,
  isFaab,
  isOpenFa,
  faabRemaining,
  isCommissioner,
}: {
  leagueId: string
  myTeamId: string
  players: PlayerRow[]
  view: 'free_agents' | 'owned' | 'all'
  myRoster: RosterPlayer[]
  myClaims: PendingClaim[]
  isFaab: boolean
  isOpenFa: boolean
  faabRemaining: number
  isCommissioner: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRow | null>(null)
  const [dropPlayerId, setDropPlayerId] = useState<string>('')
  const [bidAmount, setBidAmount] = useState<number>(1)
  const [submitting, setSubmitting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Only FA players can be claimed
  const canClaim = (p: PlayerRow) => !p.owned_by

  function handleRowClick(p: PlayerRow) {
    if (!canClaim(p)) return
    setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)
    setError(null)
  }

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
      setSuccess(isOpenFa
        ? `${selectedPlayer.full_name} added to your roster!`
        : `Claim submitted for ${selectedPlayer.full_name}!`)
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

  const showClaimPanel = view === 'free_agents' || (view === 'all' && !!selectedPlayer)

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">{success}</div>
      )}

      {/* Commissioner: process claims */}
      {isCommissioner && !isOpenFa && view === 'free_agents' && (
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
      {myClaims.length > 0 && view === 'free_agents' && (
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

      <div className={`grid gap-6 ${showClaimPanel ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {/* Player table */}
        <div className={showClaimPanel ? 'col-span-2' : 'col-span-1'}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
                    <th className="text-right px-3 py-2.5 w-12">Rank</th>
                    <th className="text-left px-4 py-2.5">Player</th>
                    <th className="text-left px-3 py-2.5">Pos</th>
                    <th className="text-left px-3 py-2.5">Team</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-right px-3 py-2.5">Pts</th>
                    {view !== 'free_agents' && (
                      <th className="text-left px-3 py-2.5">Owner</th>
                    )}
                    {view !== 'owned' && (
                      <th className="px-3 py-2.5 w-16" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-gray-500">
                        No players match your search.
                      </td>
                    </tr>
                  ) : players.map(p => {
                    const isSelected = selectedPlayer?.id === p.id
                    const isFa = !p.owned_by
                    const clickable = isFa && view !== 'owned'
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-gray-800 last:border-0 transition-colors ${
                          isSelected
                            ? 'bg-red-900/30'
                            : clickable
                              ? 'hover:bg-gray-800/40 cursor-pointer'
                              : ''
                        }`}
                        onClick={() => clickable ? handleRowClick(p) : undefined}
                      >
                        {/* Rank */}
                        <td className="px-3 py-2.5 text-right">
                          {p.rank
                            ? <span className="text-xs font-mono text-gray-400">#{p.rank}</span>
                            : <span className="text-xs text-gray-700">—</span>
                          }
                        </td>

                        {/* Name */}
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/players/${p.id}?leagueId=${leagueId}`}
                            className="font-medium text-white hover:text-red-400 transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            {p.full_name}
                          </Link>
                          {p.is_rookie && <span className="ml-1 text-xs text-yellow-400">R</span>}
                          {p.probable_starts && p.probable_starts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
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

                        {/* Pos */}
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{p.primary_position}</td>

                        {/* MLB Team */}
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{p.mlb_team ?? '—'}</td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-medium ${STATUS_COLOR[p.status] ?? 'text-gray-400'}`}>
                            {STATUS_LABEL[p.status] ?? p.status}
                          </span>
                        </td>

                        {/* Season pts */}
                        <td className="px-3 py-2.5 text-right">
                          {p.season_pts != null
                            ? <span className="text-xs font-mono text-yellow-300">{p.season_pts.toFixed(1)}</span>
                            : <span className="text-xs text-gray-700">—</span>
                          }
                        </td>

                        {/* Owned by (owned/all views) */}
                        {view !== 'free_agents' && (
                          <td className="px-3 py-2.5 text-xs">
                            {p.owned_by
                              ? <Link
                                  href={`/league/${leagueId}/team/${p.owned_by.id}`}
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {p.owned_by.abbreviation}
                                </Link>
                              : <span className="text-gray-600">FA</span>
                            }
                          </td>
                        )}

                        {/* Action */}
                        {view !== 'owned' && (
                          <td className="px-3 py-2.5 text-right">
                            {isFa && (
                              <span className="text-xs text-red-400">
                                {isSelected ? '▶' : isOpenFa ? 'Add' : 'Claim'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Claim panel */}
        {showClaimPanel && (
          <div className="col-span-1">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4 sticky top-4">
              <h3 className="font-semibold text-sm text-white">{isOpenFa ? 'Add Player' : 'Claim Player'}</h3>

              {!selectedPlayer ? (
                <p className="text-xs text-gray-500">
                  {isOpenFa ? 'Select a free agent to add them.' : 'Select a free agent to claim them.'}
                </p>
              ) : (
                <>
                  <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
                    <p className="font-semibold text-sm text-white">{selectedPlayer.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{selectedPlayer.primary_position} · {selectedPlayer.mlb_team ?? 'FA'}</p>
                    {selectedPlayer.rank && (
                      <p className="text-xs text-gray-500 mt-0.5">#{selectedPlayer.rank} OVR · {selectedPlayer.season_pts?.toFixed(1) ?? '0'} pts</p>
                    )}
                  </div>

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
                      Claim is processed on waiver day. No one else claims → player is yours.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
