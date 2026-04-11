'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getEligibleSlotsForPositions } from '@/lib/scoring'
import { HistoryView, type SeasonRecord } from '@/components/league/HistoryView'

// ─── Date navigation helpers ──────────────────────────────────────────────────

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RosterPlayer {
  roster_id: string
  player_id: string
  mlb_id: number
  full_name: string
  primary_position: string
  eligible_positions?: string[]
  mlb_team: string | null
  status: string
  slot_type: string
  is_rookie: boolean
  is_second_year: boolean
  nickname?: string | null
}

export interface FullSettings {
  spots_c: number
  spots_1b: number
  spots_2b: number
  spots_3b: number
  spots_ss: number
  spots_of: number
  spots_if: number
  spots_util: number
  spots_sp: number
  spots_rp: number
  spots_p: number
  spots_bench: number
  spots_il: number
  has_taxi_squad: boolean
}

interface ContractInfo {
  id: string
  salary: number
  years_total: number
  years_remaining: number
  expires_after_season: number
  contract_type: string
}

interface WeekScore {
  fantasy_points: number
  batting: Record<string, number> | null
  pitching: Record<string, number> | null
}

interface RosterSlot {
  slot_type: string
  label: string
  player: RosterPlayer | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS',
  IF: 'IF', OF: 'OF', UTIL: 'UTIL',
  SP: 'SP', RP: 'RP', P: 'P',
  BENCH: 'BN', IL: 'IL', TAXI: 'TX', NA: 'NA',
}

const STATUS_STYLES: Record<string, string> = {
  active:   'text-green-400',
  injured:  'text-red-400',
  IL10:     'text-orange-400',
  IL60:     'text-red-400',
  minors:   'text-yellow-400',
  inactive: 'text-gray-500',
}

const PITCHER_POSITIONS = new Set(['SP', 'RP'])

// Display order for positions in eligibility label
const POS_ORDER = ['C','1B','2B','SS','3B','OF','DH','SP','RP']

function formatEligiblePositions(primary: string, eligible?: string[]): string {
  if (!eligible || eligible.length <= 1) return primary
  const filtered = eligible.filter(p => p !== 'DH')
  if (filtered.length <= 1) return filtered[0] ?? primary
  const sorted = [...filtered].sort((a, b) => {
    const ai = POS_ORDER.indexOf(a)
    const bi = POS_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return sorted.join('/')
}

// ─── Slot template builder ────────────────────────────────────────────────────

function buildRosterSlots(players: RosterPlayer[], s: FullSettings): RosterSlot[] {
  const bySlot: Record<string, RosterPlayer[]> = {}
  for (const p of players) {
    if (!bySlot[p.slot_type]) bySlot[p.slot_type] = []
    bySlot[p.slot_type].push(p)
  }

  const used: Record<string, number> = {}
  function take(slotType: string): RosterPlayer | null {
    const arr = bySlot[slotType] ?? []
    const idx = used[slotType] ?? 0
    used[slotType] = idx + 1
    return arr[idx] ?? null
  }
  function makeSlots(slotType: string, count: number): RosterSlot[] {
    return Array.from({ length: count }, () => ({
      slot_type: slotType,
      label: SLOT_LABELS[slotType] ?? slotType,
      player: take(slotType),
    }))
  }

  const benchPlayers = bySlot['BENCH'] ?? []
  const benchHitters  = benchPlayers.filter(p => !PITCHER_POSITIONS.has(p.primary_position))
  const benchPitchers = benchPlayers.filter(p => PITCHER_POSITIONS.has(p.primary_position))

  const ilPlayers   = bySlot['IL']   ?? []
  const taxiPlayers = bySlot['TAXI'] ?? []
  const naPlayers   = bySlot['NA']   ?? []

  return [
    // Active hitter slots
    ...makeSlots('C',    s.spots_c),
    ...makeSlots('1B',   s.spots_1b),
    ...makeSlots('2B',   s.spots_2b),
    ...makeSlots('SS',   s.spots_ss),
    ...makeSlots('3B',   s.spots_3b),
    ...(s.spots_if > 0 ? makeSlots('IF', s.spots_if) : []),
    ...makeSlots('OF',   s.spots_of),
    ...makeSlots('UTIL', s.spots_util),
    // Bench hitters (dynamic)
    ...benchHitters.map(p => ({ slot_type: 'BENCH', label: 'BN', player: p })),
    // Active pitcher slots
    ...makeSlots('SP', s.spots_sp),
    ...makeSlots('RP', s.spots_rp),
    ...(s.spots_p > 0 ? makeSlots('P', s.spots_p) : []),
    // Bench pitchers (dynamic)
    ...benchPitchers.map(p => ({ slot_type: 'BENCH', label: 'BN', player: p })),
    // IL: always show at least spots_il rows
    ...Array.from({ length: Math.max(s.spots_il, ilPlayers.length) }, (_, i) => ({
      slot_type: 'IL', label: 'IL', player: ilPlayers[i] ?? null,
    })),
    // TAXI: show 3 rows if has_taxi_squad
    ...(s.has_taxi_squad
      ? Array.from({ length: Math.max(3, taxiPlayers.length) }, (_, i) => ({
          slot_type: 'TAXI', label: 'TX', player: taxiPlayers[i] ?? null,
        }))
      : []),
    // NA: only players actually in NA
    ...naPlayers.map(p => ({ slot_type: 'NA', label: 'NA', player: p })),
  ]
}

// Format statline like "1/4, 2B, 1R" for batters or "6.0IP, 8K, 1ER" for pitchers
function formatStatline(b: Record<string, number> | null, p: Record<string, number> | null): string {
  if (b) {
    const parts: string[] = []
    const singles = b.H ?? 0       // H stores singles only after scoring fix
    const doubles = b['2B'] ?? 0
    const triples = b['3B'] ?? 0
    const hrs     = b.HR ?? 0
    const totalHits = singles + doubles + triples + hrs
    const ab = b.AB ?? 0

    if (ab > 0) {
      parts.push(`${totalHits}/${ab}`)
    } else if (totalHits > 0) {
      parts.push(`${totalHits}H`)
    }
    if (singles > 0) parts.push(singles === 1 ? '1B'         : `${singles} 1B`)
    if (doubles > 0) parts.push(doubles === 1 ? '2B'         : `${doubles} 2B`)
    if (triples > 0) parts.push(triples === 1 ? '3B'         : `${triples} 3B`)
    if (hrs     > 0) parts.push(hrs     === 1 ? 'HR'         : `${hrs} HR`)
    if ((b.R   ?? 0) > 0) parts.push(b.R   === 1 ? 'R'   : `${b.R} R`)
    if ((b.RBI ?? 0) > 0) parts.push(b.RBI === 1 ? 'RBI' : `${b.RBI} RBI`)
    if ((b.SB  ?? 0) > 0) parts.push(b.SB  === 1 ? 'SB'  : `${b.SB} SB`)
    return parts.join(', ')
  }
  if (p) {
    const parts: string[] = []
    if ((p.W  ?? 0) > 0)   parts.push('W')
    if ((p.SV ?? 0) > 0)   parts.push('SV')
    if ((p.IP ?? 0) > 0)   parts.push(`${p.IP} IP`)
    if ((p.K  ?? 0) > 0)   parts.push(`${p.K} K`)
    if (p.ER !== undefined) parts.push(`${p.ER} ER`)
    return parts.join(', ')
  }
  return ''
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RosterGrid({
  players, leagueId, teamId, settings,
  isContractLeague = false, contracts = {},
  weekScores = {}, todayScores = {}, seasonYear,
  selectedDate, matchupPeriod, isReadOnly = false,
  liveTeams = [], probableStarterIds = [],
  historyRecords = [],
}: {
  players: RosterPlayer[]
  leagueId: string
  teamId: string
  settings: FullSettings
  isContractLeague?: boolean
  contracts?: Record<string, ContractInfo>
  weekScores?: Record<string, WeekScore>
  todayScores?: Record<string, WeekScore>
  seasonYear?: number
  selectedDate?: string
  matchupPeriod?: { start: string; end: string } | null
  isReadOnly?: boolean
  liveTeams?: string[]
  probableStarterIds?: string[]
  historyRecords?: SeasonRecord[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pendingId,  setPendingId]  = useState<string | null>(null)
  const [droppingId, setDroppingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'roster' | 'payroll' | 'history'>('roster')

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const displayDate = selectedDate ?? today
  const isToday = displayDate === today

  function navigateDate(delta: number) {
    const newDate = addDays(displayDate, delta)
    // Don't navigate before matchup start or after today+6 (planning future lineup)
    const minDate = matchupPeriod?.start ?? '2020-01-01'
    const maxDate = addDays(today, 6)
    if (newDate < minDate || newDate > maxDate) return
    startTransition(() => router.push(`?date=${newDate}`))
  }

  const slots = buildRosterSlots(players, settings)
  const totalPayroll = Object.values(contracts).reduce((s, c) => s + Number(c.salary), 0)

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
    if (!confirm(`Drop ${name}? This cannot be undone.`)) return
    setDroppingId(playerId)
    setError(null)
    const res = await fetch(`/api/leagues/${leagueId}/roster/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error)
    else startTransition(() => router.refresh())
    setDroppingId(null)
  }

  if (players.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
        No players on your roster yet. Add players via Waivers or complete the Draft.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setView('roster')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === 'roster' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Roster
          </button>
          {isContractLeague && (
            <button
              onClick={() => setView('payroll')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === 'payroll' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Payroll
            </button>
          )}
          <button
            onClick={() => setView('history')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${view === 'history' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            History
          </button>
        </div>

        {/* Date navigator — shows stats for selected date */}
        {view === 'roster' && (
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
            <button
              onClick={() => navigateDate(-1)}
              className="text-gray-400 hover:text-white transition-colors px-1"
            >
              ‹
            </button>
            <span className={`text-sm font-medium min-w-[120px] text-center ${isToday ? 'text-white' : 'text-blue-300'}`}>
              {isToday ? 'Today' : formatDate(displayDate)}
            </span>
            <button
              onClick={() => navigateDate(1)}
              className="text-gray-400 hover:text-white transition-colors px-1"
            >
              ›
            </button>
            {!isToday && (
              <button
                onClick={() => startTransition(() => router.push('?'))}
                className="ml-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Today
              </button>
            )}
          </div>
        )}

        {isContractLeague && view !== 'history' && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Payroll</p>
            <p className={`text-lg font-bold ${totalPayroll >= 200 ? 'text-red-400' : 'text-green-400'}`}>
              {fmtM(totalPayroll)}
            </p>
          </div>
        )}
      </div>

      {view === 'roster' && (
        <RosterView
          slots={slots} settings={settings}
          isContractLeague={isContractLeague} contracts={contracts}
          weekScores={weekScores} todayScores={todayScores}
          pendingId={pendingId} droppingId={droppingId}
          onChangeSlot={changeSlot} onDrop={dropPlayer}
          selectedDate={displayDate} isReadOnly={isReadOnly}
          liveTeams={liveTeams} probableStarterIds={probableStarterIds}
        />
      )}
      {view === 'payroll' && (
        <PayrollView
          players={players} contracts={contracts}
          seasonYear={seasonYear ?? new Date().getFullYear()}
          leagueId={leagueId} teamId={teamId}
          onSaved={() => startTransition(() => router.refresh())}
          isReadOnly={isReadOnly}
        />
      )}
      {view === 'history' && (
        <HistoryView
          teamId={teamId}
          records={historyRecords}
          isOwner={!isReadOnly}
        />
      )}

      {!isReadOnly && (
        <p className="text-xs text-gray-600">
          Change a player&apos;s slot using the dropdown. Use Waivers to add free agents.
        </p>
      )}
    </div>
  )
}

// ─── Roster view ──────────────────────────────────────────────────────────────

function RosterView({
  slots, settings, isContractLeague, contracts, weekScores, todayScores,
  pendingId, droppingId, onChangeSlot, onDrop, selectedDate, isReadOnly,
  liveTeams, probableStarterIds, isToday,
}: {
  slots: RosterSlot[]
  settings: FullSettings
  isContractLeague: boolean
  contracts: Record<string, ContractInfo>
  weekScores: Record<string, WeekScore>
  todayScores: Record<string, WeekScore>
  pendingId: string | null
  droppingId: string | null
  onChangeSlot: (id: string, slot: string) => void
  onDrop: (playerId: string, name: string) => void
  selectedDate?: string
  isReadOnly?: boolean
  liveTeams?: string[]
  probableStarterIds?: string[]
  isToday?: boolean
}) {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const viewingToday = !selectedDate || selectedDate === todayStr
  const dayLabel = viewingToday ? 'Td' : formatDate(selectedDate!).split(',')[0]  // e.g. "Mon"
  const liveSet = new Set(liveTeams ?? [])
  const probableSet = new Set(probableStarterIds ?? [])
  const splitIdx = slots.findIndex(s => ['BENCH', 'IL', 'TAXI', 'NA'].includes(s.slot_type))
  const activeSlots   = splitIdx === -1 ? slots : slots.slice(0, splitIdx)
  const inactiveSlots = splitIdx === -1 ? []    : slots.slice(splitIdx)

  function SlotRow({ slot }: { slot: RosterSlot }) {
    const p        = slot.player
    const dropping = p ? droppingId === p.player_id : false
    const loading  = p ? pendingId  === p.roster_id  : false
    const week     = p ? weekScores[p.player_id]  : null
    const dayScore = p ? todayScores[p.player_id] : null
    const contract = p ? contracts[p.player_id]   : null
    const todayLine = dayScore ? formatStatline(dayScore.batting, dayScore.pitching) : ''

    const eligible = p ? getEligibleSlotsForPositions(
      p.eligible_positions?.length ? p.eligible_positions : [p.primary_position],
      { spots_if: settings.spots_if, spots_util: settings.spots_util, spots_p: settings.spots_p, spots_taxi: settings.has_taxi_squad ? 1 : 0 },
      { status: p.status, isRookie: p.is_rookie, isSecondYear: p.is_second_year }
    ) : []

    // Live game: player's MLB team is currently playing (only applies when viewing today)
    const isLive = viewingToday && !!p?.mlb_team && liveSet.has(p.mlb_team)
    // Probable starter: pitcher is scheduled to start on the selected date
    const isProbable = !!p && probableSet.has(p.player_id)

    return (
      <tr className={`border-b border-gray-800 last:border-0 transition-colors ${isLive ? 'bg-green-950/40 hover:bg-green-950/60' : p ? 'hover:bg-gray-800/30' : ''}`}>
        {/* Slot label */}
        <td className="px-2 py-2 w-9">
          <span className="text-xs font-mono font-bold text-gray-500">{slot.label}</span>
        </td>

        {/* Player: headshot + name + status inline */}
        <td className="px-2 py-1.5">
          {p ? (
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                <Image
                  src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.mlb_id}/headshot/67/current`}
                  alt={p.full_name}
                  fill
                  className="object-cover object-center"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <Link
                    href={`/players/${p.player_id}`}
                    className="font-medium text-white text-sm hover:text-red-400 transition-colors truncate"
                  >
                    {p.full_name}
                  </Link>
                  {p.nickname && (
                    <span className="text-xs text-gray-400 italic flex-shrink-0">({p.nickname})</span>
                  )}
                  {/* IL designation badge */}
                  {(p.status === 'IL10' || p.status === 'IL60') && (
                    <span className="text-xs font-bold text-orange-400 flex-shrink-0">{p.status}</span>
                  )}
                  {/* 2nd-year overrides rookie badge */}
                  {p.is_second_year
                    ? <span className="text-xs font-medium text-blue-400 flex-shrink-0">2nd</span>
                    : p.is_rookie && <span className="text-xs font-bold text-yellow-400 flex-shrink-0">R</span>
                  }
                  {isProbable && (
                    <span className="text-green-400 flex-shrink-0" title="Probable starter">✓</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {formatEligiblePositions(p.primary_position, p.eligible_positions)}
                  {p.mlb_team ? ` · ${p.mlb_team}` : ''}
                  {' · '}
                  <span className={STATUS_STYLES[p.status] ?? 'text-gray-500'}>{p.status}</span>
                </p>
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-700 italic pl-10">Empty</span>
          )}
        </td>

        {/* Pts: week total + today's pts + statline */}
        <td className="px-2 py-2 text-right w-32">
          {week ? (
            <div>
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-xs text-gray-500">Wk</span>
                <span className="text-sm font-semibold text-white">
                  {week.fantasy_points > 0 ? `+${week.fantasy_points.toFixed(1)}` : '0'}
                </span>
              </div>
              {dayScore && (
                <div className="flex items-baseline justify-end gap-1 mt-0.5">
                  <span className="text-xs text-gray-600">{dayLabel}</span>
                  <span className="text-xs font-medium text-gray-300">
                    {dayScore.fantasy_points > 0 ? `+${dayScore.fantasy_points.toFixed(1)}` : '0'}
                  </span>
                </div>
              )}
              {todayLine && <p className="text-xs text-gray-500 mt-0.5">{todayLine}</p>}
            </div>
          ) : p ? (
            <span className="text-xs text-gray-700">—</span>
          ) : null}
        </td>

        {/* Salary */}
        {isContractLeague && (
          <td className="px-2 py-2 text-right w-16">
            {contract ? (
              <>
                <span className="text-sm text-green-400 font-medium">${contract.salary}</span>
                <p className="text-xs text-gray-600">{contract.years_remaining}yr</p>
              </>
            ) : p ? (
              <span className="text-xs text-gray-700">—</span>
            ) : null}
          </td>
        )}

        {/* Slot selector */}
        {!isReadOnly && (
          <td className="px-2 py-2 w-32">
            {p && (
              <select
                value={p.slot_type}
                disabled={loading}
                onChange={e => onChangeSlot(p.roster_id, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500 disabled:opacity-50 w-full"
              >
                {eligible.map(s => (
                  <option key={s} value={s}>{SLOT_LABELS[s] ?? s}</option>
                ))}
              </select>
            )}
          </td>
        )}

        {/* Drop */}
        {!isReadOnly && (
          <td className="px-2 py-2 text-right w-12">
            {p && (
              <button
                onClick={() => onDrop(p.player_id, p.full_name)}
                disabled={dropping}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {dropping ? '…' : 'Drop'}
              </button>
            )}
          </td>
        )}
      </tr>
    )
  }

  function Section({ rows, label, subtitle }: { rows: RosterSlot[]; label: string; subtitle: string }) {
    if (rows.length === 0) return null
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-800/40">
          <h3 className="font-semibold text-sm text-white">
            {label}
            <span className="ml-2 text-xs text-gray-400 font-normal">— {subtitle}</span>
          </h3>
        </div>
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-2 py-2 w-9">Slot</th>
              <th className="text-left px-2 py-2">Player</th>
              <th className="text-right px-2 py-2 w-32">Pts</th>
              {isContractLeague && <th className="text-right px-2 py-2 w-16">AAV</th>}
              {!isReadOnly && <th className="text-left px-2 py-2 w-32">Move to</th>}
              {!isReadOnly && <th className="px-2 py-2 w-12" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((slot, i) => <SlotRow key={`${slot.slot_type}-${i}`} slot={slot} />)}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Section rows={activeSlots}   label="Active Lineup"           subtitle="these players score points" />
      <Section rows={inactiveSlots} label="Bench / IL / Taxi / NA"  subtitle="these players do not score" />
    </div>
  )
}

// ─── Payroll helpers ──────────────────────────────────────────────────────────

function fmtM(n: number): string {
  return `$${n % 1 === 0 ? n : n.toFixed(1)}M`
}

const TAX_TIERS = [
  { min: 240, label: '240M+',        penalties: ['Lose all prospects'] },
  { min: 230, label: '230–239.9M',   penalties: ['Can only keep 1 prospect'] },
  { min: 220, label: '220–229.9M',   penalties: [] },
  { min: 210, label: '210–219.9M',   penalties: ['Lose all draft picks', 'Lose HTD'] },
  { min: 200, label: '200–209.9M',   penalties: ['Draft pick pushed to end of round', 'Lose Young Player Extension (following season)'] },
] as const

function getActiveTaxTiers(total: number) {
  if (total < 200) return []
  return TAX_TIERS.filter(t => total >= t.min).reverse() // lowest to highest
}

// ─── Payroll view ─────────────────────────────────────────────────────────────

const BLANK_CONTRACT: Omit<ContractInfo, 'id'> = {
  salary: 1,
  years_total: 1,
  years_remaining: 1,
  expires_after_season: new Date().getFullYear(),
  contract_type: 'standard',
}

function PayrollView({
  players, contracts, seasonYear, leagueId, teamId, onSaved, isReadOnly = false,
}: {
  players: RosterPlayer[]
  contracts: Record<string, ContractInfo>
  seasonYear: number
  leagueId: string
  teamId: string
  onSaved: () => void
  isReadOnly?: boolean
}) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<ContractInfo, 'id'>>(BLANK_CONTRACT)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const years = [0, 1, 2, 3, 4].map(n => seasonYear + n)

  const POSITION_RANK: Record<string, number> = {
    C: 0, '1B': 1, '2B': 2, SS: 3, '3B': 4, OF: 5, DH: 6, SP: 10, RP: 11,
  }
  const sorted = [...players].sort((a, b) =>
    (POSITION_RANK[a.primary_position] ?? 7) - (POSITION_RANK[b.primary_position] ?? 7) ||
    a.full_name.localeCompare(b.full_name)
  )

  function startEdit(p: RosterPlayer) {
    const c = contracts[p.player_id]
    setForm(c
      ? { salary: c.salary, years_total: c.years_total, years_remaining: c.years_remaining, expires_after_season: c.expires_after_season, contract_type: c.contract_type }
      : { ...BLANK_CONTRACT, expires_after_season: seasonYear }
    )
    setSaveError(null)
    setEditingPlayerId(p.player_id)
  }

  async function save(player: RosterPlayer) {
    setSaving(true)
    setSaveError(null)
    const existing = contracts[player.player_id]
    let res: Response

    if (existing) {
      res = await fetch(`/api/leagues/${leagueId}/contracts/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      res = await fetch(`/api/leagues/${leagueId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.player_id, team_id: teamId, ...form }),
      })
    }

    const data = await res.json()
    if (!res.ok) {
      setSaveError(data.error ?? 'Failed to save')
    } else {
      setEditingPlayerId(null)
      onSaved()
    }
    setSaving(false)
  }

  function salaryForYear(c: ContractInfo | undefined, year: number): number | null {
    if (!c) return null
    if (year > c.expires_after_season) return null
    return Number(c.salary)
  }

  const yearTotals = years.map(y =>
    sorted.reduce((sum, p) => sum + (salaryForYear(contracts[p.player_id], y) ?? 0), 0)
  )

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-800/40">
        <h3 className="font-semibold text-sm text-white">Payroll — Next 5 Seasons</h3>
        {!isReadOnly && <p className="text-xs text-gray-500 mt-0.5">Click &quot;Set&quot; or &quot;Edit&quot; on any player to assign or update their contract.</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-4 py-2.5">Player</th>
              <th className="text-left px-4 py-2.5 w-10">Pos</th>
              <th className="text-left px-4 py-2.5 w-10">Type</th>
              {years.map(y => (
                <th key={y} className={`text-right px-4 py-2.5 w-20 ${y === seasonYear ? 'text-white' : ''}`}>
                  {y}
                </th>
              ))}
              {!isReadOnly && <th className="px-4 py-2.5 w-20" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const c = contracts[p.player_id]
              const isEditing = editingPlayerId === p.player_id
              return (
                <React.Fragment key={p.player_id}>
                  <tr className="border-b border-gray-800 hover:bg-gray-800/20">
                    <td className="px-4 py-2.5">
                      <Link href={`/players/${p.player_id}`} className="text-white hover:text-red-400 transition-colors font-medium text-sm">
                        {p.full_name}
                      </Link>
                      <p className="text-xs text-gray-500">{p.mlb_team ?? 'FA'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{p.primary_position}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {c ? { standard: 'STD', rookie: 'RK', extension: 'EXT', minimum: 'MIN' }[c.contract_type] ?? c.contract_type : '—'}
                    </td>
                    {years.map(y => {
                      const sal = salaryForYear(c, y)
                      return (
                        <td key={y} className="px-4 py-2.5 text-right">
                          {sal !== null
                            ? <span className={`font-medium ${y === seasonYear ? 'text-green-400' : 'text-gray-300'}`}>{fmtM(sal)}</span>
                            : <span className="text-gray-700">—</span>}
                        </td>
                      )
                    })}
                    {!isReadOnly && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => isEditing ? setEditingPlayerId(null) : startEdit(p)}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                        >
                          {isEditing ? 'Cancel' : c ? 'Edit' : 'Set'}
                        </button>
                      </td>
                    )}
                  </tr>

                  {/* Inline edit form */}
                  {isEditing && (
                    <tr className="border-b border-gray-800 bg-gray-800/40">
                      <td colSpan={years.length + 4} className="px-4 py-4">
                        <p className="text-xs text-gray-400 font-medium mb-3">
                          {c ? 'Edit contract for' : 'Set contract for'} <span className="text-white">{p.full_name}</span>
                        </p>
                        {saveError && <p className="text-red-400 text-xs mb-3">{saveError}</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Salary ($M)</label>
                            <input
                              type="number" min={1}
                              value={form.salary}
                              onChange={e => setForm(f => ({ ...f, salary: Number(e.target.value) }))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Type</label>
                            <select
                              value={form.contract_type}
                              onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                            >
                              <option value="standard">Standard</option>
                              <option value="rookie">Rookie</option>
                              <option value="extension">Extension</option>
                              <option value="minimum">Minimum</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Years Total</label>
                            <input
                              type="number" min={1}
                              value={form.years_total}
                              onChange={e => setForm(f => ({ ...f, years_total: Number(e.target.value) }))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Years Remaining</label>
                            <input
                              type="number" min={0}
                              value={form.years_remaining}
                              onChange={e => setForm(f => ({ ...f, years_remaining: Number(e.target.value) }))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Expires After</label>
                            <input
                              type="number"
                              value={form.expires_after_season}
                              onChange={e => setForm(f => ({ ...f, expires_after_season: Number(e.target.value) }))}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-red-500"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => save(p)}
                          disabled={saving}
                          className="mt-3 px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium text-white disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'Saving…' : 'Save Contract'}
                        </button>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700 bg-gray-800/40">
              <td colSpan={3} className="px-4 py-3 text-sm font-bold text-white">Total Payroll</td>
              {yearTotals.map((total, i) => {
                const overTax = total >= 200
                return (
                  <td key={i} className="px-4 py-3 text-right font-bold">
                    {total > 0
                      ? <span className={overTax ? 'text-red-400' : 'text-green-400'}>{fmtM(total)}</span>
                      : <span className="text-gray-700">—</span>}
                  </td>
                )
              })}
              {!isReadOnly && <td className="px-4 py-3" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Tax penalty banner — shown when current season payroll hits a tier */}
      {(() => {
        const tiers = getActiveTaxTiers(yearTotals[0])
        if (tiers.length === 0) return null
        const allPenalties = tiers.flatMap(t => t.penalties)
        return (
          <div className="mx-4 mb-4 mt-0 bg-red-950/50 border border-red-800/60 rounded-lg px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">
              ⚠ Luxury Tax Penalties
            </p>
            {allPenalties.length > 0 ? (
              <ul className="space-y-0.5">
                {allPenalties.map((p, i) => (
                  <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">•</span>{p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-red-400/70 italic">No additional penalties at this tier.</p>
            )}
            <p className="text-xs text-red-500/60 pt-0.5">
              Consecutive years over 200M move you to the next tier.
            </p>
          </div>
        )
      })()}
    </div>
  )
}
