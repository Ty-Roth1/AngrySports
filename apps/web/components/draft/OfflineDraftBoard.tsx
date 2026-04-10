'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Player {
  id: string
  mlb_id: number
  full_name: string
  primary_position: string
  mlb_team: string | null
  is_rookie: boolean
}

interface DraftPick {
  id: string
  team_id: string
  player_id: string
  pick_number: number
  round: number
  bid_amount: number | null
  players: { full_name: string; primary_position: string; mlb_team: string | null }
}

interface Team {
  id: string
  name: string
  abbreviation: string
  faab_remaining: number
  profiles: { display_name: string } | null
}

interface Draft {
  id: string
  phase: string
  draft_type: string
  is_offline: boolean
  draft_picks: DraftPick[]
}

interface League {
  id: string
  name: string
  is_contract_league: boolean
  league_settings: { auction_budget: number; max_contract_years: number } | null
}

export function OfflineDraftBoard({ draft, league, teams, isCommissioner, leagueId }: {
  draft: Draft
  league: League
  teams: Team[]
  isCommissioner: boolean
  leagueId: string
}) {
  const router = useRouter()
  const isAuction = draft.draft_type === 'auction'

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? '')
  const [bidAmount, setBidAmount] = useState<number>(1)
  const [contractYears, setContractYears] = useState<number>(1)
  const [currentPick, setCurrentPick] = useState(draft.draft_picks.length + 1)
  const [currentRound, setCurrentRound] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Collect already-drafted player IDs
  const draftedIds = new Set(draft.draft_picks.map(p => p.player_id))

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(q)}&exclude_drafted_league=${leagueId}`)
    if (res.ok) {
      const data = await res.json()
      setSearchResults(data.players.filter((p: Player) => !draftedIds.has(p.id)))
    }
  }, [leagueId, draftedIds])

  async function submitPick() {
    if (!selectedPlayer || !selectedTeamId) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/leagues/${leagueId}/draft/pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_id: draft.id,
        team_id: selectedTeamId,
        player_id: selectedPlayer.id,
        pick_number: currentPick,
        round: currentRound,
        bid_amount: isAuction ? bidAmount : null,
        contract_years: league.is_contract_league ? contractYears : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setSubmitting(false)
      return
    }

    // Advance pick counter
    setCurrentPick(p => p + 1)
    setSelectedPlayer(null)
    setQuery('')
    setSearchResults([])
    setBidAmount(1)
    setContractYears(1)
    setSubmitting(false)
    router.refresh()
  }

  const maxCap = league.league_settings?.max_contract_years ?? 3

  // Group picks by team for the pick log
  const picksByTeam: Record<string, DraftPick[]> = {}
  for (const team of teams) picksByTeam[team.id] = []
  for (const pick of draft.draft_picks) {
    if (picksByTeam[pick.team_id]) picksByTeam[pick.team_id].push(pick)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="px-3 py-1 bg-green-900 text-green-300 rounded-full text-xs font-medium">
          {draft.phase === 'rookie_draft' ? 'Rookie Draft' : 'Free Agency'} — Live
        </span>
        <span className="text-gray-400 text-sm">
          Pick #{currentPick} &middot; {isAuction ? 'Auction' : 'Snake'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Pick entry (commissioner only) */}
        {isCommissioner && (
          <div className="col-span-1 space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-sm">Enter Pick</h3>

              {/* Player search */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Search Player</label>
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); search(e.target.value) }}
                  placeholder="Name or team..."
                  autoComplete="off"
                  className="input"
                />
                {searchResults.length > 0 && (
                  <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPlayer(p); setSearchResults([]); setQuery(p.full_name) }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm flex items-center justify-between text-white"
                      >
                        <span>{p.full_name}</span>
                        <span className="text-xs text-gray-300">{p.primary_position} · {p.mlb_team}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPlayer && (
                  <div className="mt-2 px-3 py-2 bg-red-900/30 border border-red-700 rounded-lg text-sm">
                    <span className="font-medium">{selectedPlayer.full_name}</span>
                    <span className="text-gray-400 ml-2">{selectedPlayer.primary_position} · {selectedPlayer.mlb_team}</span>
                    {selectedPlayer.is_rookie && <span className="ml-2 text-yellow-400 text-xs">Rookie</span>}
                  </div>
                )}
              </div>

              {/* Team selector */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Assign To Team</label>
                <select
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  className="input"
                >
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.abbreviation})
                      {isAuction ? ` — $${t.faab_remaining} remaining` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bid amount (auction) */}
              {isAuction && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Winning Bid ($)</label>
                  <input
                    type="number"
                    min={1}
                    value={bidAmount}
                    onChange={e => setBidAmount(Number(e.target.value))}
                    className="input"
                  />
                </div>
              )}

              {/* Contract years (contract league) */}
              {league.is_contract_league && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contract Years</label>
                  <select
                    value={contractYears}
                    onChange={e => setContractYears(Number(e.target.value))}
                    className="input"
                  >
                    {Array.from({ length: maxCap }, (_, i) => i + 1).map(y => (
                      <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                onClick={submitPick}
                disabled={submitting || !selectedPlayer}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-lg text-sm font-semibold transition-colors"
              >
                {submitting ? 'Recording...' : 'Record Pick'}
              </button>
            </div>
          </div>
        )}

        {/* Right: Pick log per team */}
        <div className={`${isCommissioner ? 'col-span-2' : 'col-span-3'}`}>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="font-semibold text-sm">Pick Log — {draft.draft_picks.length} picks made</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">#</th>
                    <th className="text-left px-4 py-2.5">Player</th>
                    <th className="text-left px-4 py-2.5">Pos</th>
                    <th className="text-left px-4 py-2.5">Team</th>
                    {isAuction && <th className="text-right px-4 py-2.5">Bid</th>}
                  </tr>
                </thead>
                <tbody>
                  {draft.draft_picks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No picks yet. Use the panel on the left to record picks.
                      </td>
                    </tr>
                  )}
                  {[...draft.draft_picks]
                    .sort((a, b) => a.pick_number - b.pick_number)
                    .map(pick => {
                      const team = teams.find(t => t.id === pick.team_id)
                      return (
                        <tr key={pick.id} className="border-b border-gray-800 last:border-0">
                          <td className="px-4 py-2.5 text-gray-400">{pick.pick_number}</td>
                          <td className="px-4 py-2.5 font-medium">{pick.players?.full_name}</td>
                          <td className="px-4 py-2.5 text-gray-400">{pick.players?.primary_position}</td>
                          <td className="px-4 py-2.5 text-gray-400">{team?.abbreviation}</td>
                          {isAuction && (
                            <td className="px-4 py-2.5 text-right text-green-400">
                              {pick.bid_amount != null ? `$${pick.bid_amount}` : '—'}
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
      </div>

      {/* Team rosters summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {teams.map(team => {
          const teamPicks = picksByTeam[team.id] ?? []
          return (
            <div key={team.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{team.abbreviation}</span>
                {isAuction && (
                  <span className="text-xs text-green-400">${team.faab_remaining}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-2">{teamPicks.length} players</p>
              <ul className="space-y-0.5">
                {teamPicks.slice(-5).map(pick => (
                  <li key={pick.id} className="text-xs text-gray-300 flex justify-between">
                    <span className="truncate">{pick.players?.full_name}</span>
                    <span className="text-gray-500 ml-1">{pick.players?.primary_position}</span>
                  </li>
                ))}
                {teamPicks.length > 5 && (
                  <li className="text-xs text-gray-500">+{teamPicks.length - 5} more</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
