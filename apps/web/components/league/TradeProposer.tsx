'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  abbreviation: string
}

interface RosterPlayer {
  id: string
  player_id: string
  full_name: string
  primary_position: string
  mlb_team: string | null
  slot_type: string
}

interface DraftPick {
  id: string
  season_year: number
  round: number
  original_team: { id: string; name: string; abbreviation: string }
}

interface CounterTrade {
  id: string
  proposing_team: Team
  receiving_team: Team
  trade_items: any[]
}

function pickLabel(pick: DraftPick) {
  return `${pick.season_year} Rd ${pick.round} (${pick.original_team.abbreviation})`
}

export function TradeProposer({
  leagueId,
  myTeam,
  allTeams,
  myRoster,
  myPicks,
  cashSentThisSeason,
  cashLimit,
  counterTrade,
  onSuccess,
  onError,
}: {
  leagueId: string
  myTeam: Team
  allTeams: Team[]
  myRoster: RosterPlayer[]
  myPicks: DraftPick[]
  cashSentThisSeason: number
  cashLimit: number
  counterTrade: CounterTrade | null
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [partnerTeamId, setPartnerTeamId] = useState<string>(
    counterTrade ? counterTrade.proposing_team.id : ''
  )
  const [partnerRoster, setPartnerRoster] = useState<RosterPlayer[]>([])
  const [partnerPicks, setPartnerPicks] = useState<DraftPick[]>([])
  const [partnerCashSent, setPartnerCashSent] = useState(0)

  // My offer selections
  const [myPlayerIds, setMyPlayerIds] = useState<Set<string>>(new Set())
  const [myPickIds, setMyPickIds] = useState<Set<string>>(new Set())
  const [myCash, setMyCash] = useState(0)

  // Their offer selections
  const [theirPlayerIds, setTheirPlayerIds] = useState<Set<string>>(new Set())
  const [theirPickIds, setTheirPickIds] = useState<Set<string>>(new Set())
  const [theirCash, setTheirCash] = useState(0)

  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingPartner, setLoadingPartner] = useState(false)

  const cashAvailable = cashLimit - cashSentThisSeason

  // Load partner data when team is selected
  useEffect(() => {
    if (!partnerTeamId) {
      setPartnerRoster([])
      setPartnerPicks([])
      setPartnerCashSent(0)
      return
    }

    async function loadPartner() {
      setLoadingPartner(true)
      const supabase = createClient()

      // Fetch their roster
      const { data: rosterRaw } = await supabase
        .from('rosters')
        .select('player_id, slot_type, players(id, full_name, primary_position, mlb_team)')
        .eq('team_id', partnerTeamId)
        .not('slot_type', 'in', '(IL,TAXI)')

      setPartnerRoster((rosterRaw ?? []).map((r: any) => ({
        player_id: r.player_id,
        slot_type: r.slot_type,
        ...(r.players as any),
      })))

      // Fetch their picks
      const { data: picksRaw } = await supabase
        .from('draft_picks')
        .select('id, season_year, round, original_team:original_team_id(id, name, abbreviation)')
        .eq('current_team_id', partnerTeamId)
        .eq('league_id', leagueId)
        .eq('used', false)
        .order('season_year')
        .order('round')

      setPartnerPicks((picksRaw ?? []).map((p: any) => ({ ...p, original_team: p.original_team })))

      // Fetch their cash sent this season
      const { data: completedIds } = await supabase
        .from('trades')
        .select('id')
        .eq('league_id', leagueId)
        .eq('status', 'completed')
        .or(`proposing_team_id.eq.${partnerTeamId},receiving_team_id.eq.${partnerTeamId}`)

      let cashSent = 0
      if (completedIds && completedIds.length > 0) {
        const { data: cashItems } = await supabase
          .from('trade_items')
          .select('cash_amount')
          .in('trade_id', completedIds.map((t: any) => t.id))
          .eq('from_team_id', partnerTeamId)
          .eq('item_type', 'cash')
        cashSent = (cashItems ?? []).reduce((s: number, i: any) => s + (Number(i.cash_amount) || 0), 0)
      }
      setPartnerCashSent(cashSent)
      setLoadingPartner(false)
    }

    loadPartner()
    // Reset selections when partner changes
    setTheirPlayerIds(new Set())
    setTheirPickIds(new Set())
    setTheirCash(0)
  }, [partnerTeamId, leagueId])

  // Pre-fill for counter-offer: swap the original trade's items
  useEffect(() => {
    if (!counterTrade || !partnerTeamId) return
    const originalItems = counterTrade.trade_items ?? []
    // What the original proposer was sending → we receive (pre-select as our ask)
    const theyWereSending = originalItems.filter((i: any) => i.from_team.id === counterTrade.proposing_team.id)
    const newTheirPlayerIds = new Set<string>()
    const newTheirPickIds = new Set<string>()
    let newTheirCash = 0
    for (const item of theyWereSending) {
      if (item.item_type === 'player' && item.player) newTheirPlayerIds.add(item.player.id)
      if (item.item_type === 'draft_pick' && item.draft_pick) newTheirPickIds.add(item.draft_pick.id)
      if (item.item_type === 'cash') newTheirCash += Number(item.cash_amount)
    }
    setTheirPlayerIds(newTheirPlayerIds)
    setTheirPickIds(newTheirPickIds)
    setTheirCash(newTheirCash)
  }, [counterTrade, partnerTeamId])

  function toggleSet(set: Set<string>, id: string): Set<string> {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerTeamId) { onError('Select a trade partner first'); return }

    const totalItems = myPlayerIds.size + myPickIds.size + (myCash > 0 ? 1 : 0) +
      theirPlayerIds.size + theirPickIds.size + (theirCash > 0 ? 1 : 0)
    if (totalItems === 0) { onError('Add at least one item to the trade'); return }

    if (myCash > cashAvailable) {
      onError(`You can only send $${cashAvailable} more this season`); return
    }
    if (theirCash > cashLimit - partnerCashSent) {
      onError(`They can only send $${cashLimit - partnerCashSent} more this season`); return
    }

    setSubmitting(true)

    const items: any[] = []

    // My offer
    for (const pid of myPlayerIds) {
      items.push({ item_type: 'player', player_id: pid, from_team_id: myTeam.id, to_team_id: partnerTeamId })
    }
    for (const pickId of myPickIds) {
      items.push({ item_type: 'draft_pick', draft_pick_id: pickId, from_team_id: myTeam.id, to_team_id: partnerTeamId })
    }
    if (myCash > 0) {
      items.push({ item_type: 'cash', cash_amount: myCash, from_team_id: myTeam.id, to_team_id: partnerTeamId })
    }

    // Their offer
    for (const pid of theirPlayerIds) {
      items.push({ item_type: 'player', player_id: pid, from_team_id: partnerTeamId, to_team_id: myTeam.id })
    }
    for (const pickId of theirPickIds) {
      items.push({ item_type: 'draft_pick', draft_pick_id: pickId, from_team_id: partnerTeamId, to_team_id: myTeam.id })
    }
    if (theirCash > 0) {
      items.push({ item_type: 'cash', cash_amount: theirCash, from_team_id: partnerTeamId, to_team_id: myTeam.id })
    }

    const res = await fetch(`/api/leagues/${leagueId}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiving_team_id: partnerTeamId,
        notes: notes.trim() || null,
        items,
        counter_of: counterTrade?.id ?? null,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      onError(data.error)
    } else {
      onSuccess()
    }
    setSubmitting(false)
  }

  const partnerCashAvailable = cashLimit - partnerCashSent

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Partner selector */}
      {!counterTrade && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Trade with</label>
          <select
            required
            value={partnerTeamId}
            onChange={e => setPartnerTeamId(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">Select a team…</option>
            {allTeams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {partnerTeamId && (
        <>
          <div className="grid grid-cols-2 gap-8">
            {/* My offer */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white text-sm mb-0.5">
                  {myTeam.name} sends
                </h4>
                <p className="text-xs text-gray-500">
                  Cash available: ${cashAvailable.toFixed(0)} this season
                </p>
              </div>

              {/* My players */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Players</p>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {myRoster.map(p => (
                    <label key={p.player_id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      myPlayerIds.has(p.player_id) ? 'bg-red-900/40 border border-red-700' : 'hover:bg-gray-800 border border-transparent'
                    }`}>
                      <input
                        type="checkbox"
                        className="accent-red-500"
                        checked={myPlayerIds.has(p.player_id)}
                        onChange={() => setMyPlayerIds(toggleSet(myPlayerIds, p.player_id))}
                      />
                      <span className="text-sm text-white flex-1 min-w-0 truncate">{p.full_name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{p.primary_position}</span>
                    </label>
                  ))}
                  {myRoster.length === 0 && <p className="text-xs text-gray-600">No rostered players</p>}
                </div>
              </div>

              {/* My picks */}
              {myPicks.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Draft Picks</p>
                  <div className="space-y-1">
                    {myPicks.map(pick => (
                      <label key={pick.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        myPickIds.has(pick.id) ? 'bg-red-900/40 border border-red-700' : 'hover:bg-gray-800 border border-transparent'
                      }`}>
                        <input
                          type="checkbox"
                          className="accent-red-500"
                          checked={myPickIds.has(pick.id)}
                          onChange={() => setMyPickIds(toggleSet(myPickIds, pick.id))}
                        />
                        <span className="text-sm text-white">{pickLabel(pick)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* My cash */}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                  Cash (max ${cashAvailable})
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    max={cashAvailable}
                    step={1}
                    value={myCash}
                    onChange={e => setMyCash(Math.min(Number(e.target.value), cashAvailable))}
                    className="input w-24 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Their offer */}
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-white text-sm mb-0.5">
                  {allTeams.find(t => t.id === partnerTeamId)?.name ?? '…'} sends
                </h4>
                <p className="text-xs text-gray-500">
                  Cash available: ${partnerCashAvailable.toFixed(0)} this season
                </p>
              </div>

              {loadingPartner ? (
                <p className="text-xs text-gray-500 animate-pulse">Loading their roster…</p>
              ) : (
                <>
                  {/* Their players */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Players</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {partnerRoster.map(p => (
                        <label key={p.player_id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          theirPlayerIds.has(p.player_id) ? 'bg-green-900/40 border border-green-700' : 'hover:bg-gray-800 border border-transparent'
                        }`}>
                          <input
                            type="checkbox"
                            className="accent-green-500"
                            checked={theirPlayerIds.has(p.player_id)}
                            onChange={() => setTheirPlayerIds(toggleSet(theirPlayerIds, p.player_id))}
                          />
                          <span className="text-sm text-white flex-1 min-w-0 truncate">{p.full_name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">{p.primary_position}</span>
                        </label>
                      ))}
                      {partnerRoster.length === 0 && <p className="text-xs text-gray-600">No rostered players</p>}
                    </div>
                  </div>

                  {/* Their picks */}
                  {partnerPicks.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Draft Picks</p>
                      <div className="space-y-1">
                        {partnerPicks.map(pick => (
                          <label key={pick.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            theirPickIds.has(pick.id) ? 'bg-green-900/40 border border-green-700' : 'hover:bg-gray-800 border border-transparent'
                          }`}>
                            <input
                              type="checkbox"
                              className="accent-green-500"
                              checked={theirPickIds.has(pick.id)}
                              onChange={() => setTheirPickIds(toggleSet(theirPickIds, pick.id))}
                            />
                            <span className="text-sm text-white">{pickLabel(pick)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Their cash */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                      Cash (max ${partnerCashAvailable})
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min={0}
                        max={partnerCashAvailable}
                        step={1}
                        value={theirCash}
                        onChange={e => setTheirCash(Math.min(Number(e.target.value), partnerCashAvailable))}
                        className="input w-24 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Trade summary */}
          {(myPlayerIds.size > 0 || myPickIds.size > 0 || myCash > 0 || theirPlayerIds.size > 0 || theirPickIds.size > 0 || theirCash > 0) && (
            <div className="bg-gray-800/60 rounded-xl p-4 text-sm space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Trade Summary</p>
              <div className="flex flex-wrap gap-1.5">
                {[...myPlayerIds].map(id => {
                  const p = myRoster.find(r => r.player_id === id)
                  return p ? (
                    <span key={id} className="text-xs bg-red-900/50 border border-red-800 text-red-200 px-2 py-0.5 rounded">
                      ↑ {p.full_name} ({p.primary_position})
                    </span>
                  ) : null
                })}
                {[...myPickIds].map(id => {
                  const pick = myPicks.find(p => p.id === id)
                  return pick ? (
                    <span key={id} className="text-xs bg-red-900/50 border border-red-800 text-red-200 px-2 py-0.5 rounded">
                      ↑ {pickLabel(pick)}
                    </span>
                  ) : null
                })}
                {myCash > 0 && (
                  <span className="text-xs bg-red-900/50 border border-red-800 text-red-200 px-2 py-0.5 rounded">
                    ↑ ${myCash} cash
                  </span>
                )}
                {[...theirPlayerIds].map(id => {
                  const p = partnerRoster.find(r => r.player_id === id)
                  return p ? (
                    <span key={id} className="text-xs bg-green-900/50 border border-green-800 text-green-200 px-2 py-0.5 rounded">
                      ↓ {p.full_name} ({p.primary_position})
                    </span>
                  ) : null
                })}
                {[...theirPickIds].map(id => {
                  const pick = partnerPicks.find(p => p.id === id)
                  return pick ? (
                    <span key={id} className="text-xs bg-green-900/50 border border-green-800 text-green-200 px-2 py-0.5 rounded">
                      ↓ {pickLabel(pick)}
                    </span>
                  ) : null
                })}
                {theirCash > 0 && (
                  <span className="text-xs bg-green-900/50 border border-green-800 text-green-200 px-2 py-0.5 rounded">
                    ↓ ${theirCash} cash
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Message (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note with your offer…"
              rows={2}
              maxLength={500}
              className="input text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
          >
            {submitting ? 'Sending…' : counterTrade ? 'Send Counter Offer' : 'Send Trade Proposal'}
          </button>
        </>
      )}
    </form>
  )
}
