'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getEligibleSlots } from '@/lib/scoring'

const SLOT_LABELS: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS',
  IF: 'IF', OF: 'OF', UTIL: 'UTIL',
  SP: 'SP', RP: 'RP', P: 'P',
  BENCH: 'BN', IL: 'IL', TAXI: 'TX', NA: 'NA',
}

interface Player {
  id: string
  mlb_id: number
  full_name: string
  primary_position: string
  mlb_team: string | null
  status: string
  is_rookie: boolean
  is_second_year: boolean
}

interface RosterRow {
  id: string
  team_id: string
  slot_type: string
  player_id: string
  players: Player
}

interface Team {
  id: string
  name: string
  abbreviation: string
}

interface FullSettings {
  spots_c: number; spots_1b: number; spots_2b: number; spots_3b: number; spots_ss: number
  spots_of: number; spots_if: number; spots_util: number
  spots_sp: number; spots_rp: number; spots_p: number
  spots_bench: number; spots_il: number; has_taxi_squad: boolean
}

interface FreeAgent {
  id: string
  full_name: string
  primary_position: string
  mlb_team: string | null
  status: string
}

interface Props {
  leagueId: string
  teams: Team[]
  rosterByTeam: Record<string, RosterRow[]>
  rosteredIds: string[]
  settings: FullSettings
  isContractLeague: boolean
}

export function CommissionerRosterManager({
  leagueId, teams, rosterByTeam, settings,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [droppingId, setDroppingId] = useState<string | null>(null)

  // Add player panel
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addResults, setAddResults] = useState<FreeAgent[]>([])
  const [addLoading, setAddLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  const roster = rosterByTeam[selectedTeamId] ?? []
  const team = teams.find(t => t.id === selectedTeamId)

  async function changeSlot(rosterId: string, slot: string) {
    setPendingId(rosterId)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/roster/lineup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster_id: rosterId, slot_type: slot }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error)
    else startTransition(() => router.refresh())
    setPendingId(null)
  }

  async function dropPlayer(playerId: string, name: string) {
    if (!confirm(`Drop ${name} from ${team?.name}? This cannot be undone.`)) return
    setDroppingId(playerId)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/roster/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, team_id: selectedTeamId }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error)
    else startTransition(() => router.refresh())
    setDroppingId(null)
  }

  async function searchFreeAgents() {
    if (!addSearch.trim()) return
    setAddLoading(true)
    const res = await fetch(
      `/api/leagues/${leagueId}/free-agents?q=${encodeURIComponent(addSearch)}`
    )
    if (res.ok) {
      setAddResults(await res.json())
    }
    setAddLoading(false)
  }

  async function addPlayer(playerId: string) {
    setAdding(playerId)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/roster/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, team_id: selectedTeamId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setAddResults(prev => prev.filter(p => p.id !== playerId))
      startTransition(() => router.refresh())
    }
    setAdding(null)
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Team selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-400">Viewing team:</span>
        <div className="flex flex-wrap gap-2">
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => { setSelectedTeamId(t.id); setShowAdd(false); setError(null) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                t.id === selectedTeamId
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {t.abbreviation || t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Roster table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/40 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-white">{team?.name} — Roster</h3>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold text-white transition-colors"
          >
            {showAdd ? 'Cancel Add' : '+ Add Player'}
          </button>
        </div>

        {/* Add player panel */}
        {showAdd && (
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/20">
            <p className="text-xs text-gray-400 mb-2">Search for a free agent to add to <span className="text-white">{team?.name}</span></p>
            <div className="flex gap-2">
              <input
                type="text"
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchFreeAgents()}
                placeholder="Player name..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
              />
              <button
                onClick={searchFreeAgents}
                disabled={addLoading}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white disabled:opacity-50 transition-colors"
              >
                {addLoading ? '…' : 'Search'}
              </button>
            </div>
            {addResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {addResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded">
                    <div>
                      <span className="text-sm text-white font-medium">{p.full_name}</span>
                      <span className="ml-2 text-xs text-gray-400">{p.primary_position}{p.mlb_team ? ` · ${p.mlb_team}` : ''}</span>
                    </div>
                    <button
                      onClick={() => addPlayer(p.id)}
                      disabled={adding === p.id}
                      className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-medium text-white disabled:opacity-50 transition-colors"
                    >
                      {adding === p.id ? '…' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <table className="w-full text-sm text-white">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-3 py-2 w-10">Slot</th>
              <th className="text-left px-3 py-2">Player</th>
              <th className="text-left px-3 py-2 w-32">Move to</th>
              <th className="px-3 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-600">No players on this team&apos;s roster.</td>
              </tr>
            ) : (
              roster.map(r => {
                const p = r.players
                const loading = pendingId === r.id
                const dropping = droppingId === p.id
                const eligible = getEligibleSlots(
                  p.primary_position,
                  { spots_if: settings.spots_if, spots_util: settings.spots_util, spots_p: settings.spots_p, spots_taxi: settings.has_taxi_squad ? 1 : 0 },
                  { status: p.status, isRookie: p.is_rookie, isSecondYear: p.is_second_year }
                )
                return (
                  <tr key={r.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono font-bold text-gray-500">
                        {SLOT_LABELS[r.slot_type] ?? r.slot_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-white text-sm">{p.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {p.primary_position}{p.mlb_team ? ` · ${p.mlb_team}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={r.slot_type}
                        disabled={loading}
                        onChange={e => changeSlot(r.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500 disabled:opacity-50 w-full"
                      >
                        {eligible.map(s => (
                          <option key={s} value={s}>{SLOT_LABELS[s] ?? s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => dropPlayer(p.id, p.full_name)}
                        disabled={dropping}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        {dropping ? '…' : 'Drop'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
