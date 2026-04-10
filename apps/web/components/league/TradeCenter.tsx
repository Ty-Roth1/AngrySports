'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TradeProposer } from './TradeProposer'

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

interface TradeItem {
  id: string
  item_type: 'player' | 'draft_pick' | 'cash'
  cash_amount: number | null
  from_team: { id: string; name: string }
  to_team: { id: string; name: string }
  player?: { id: string; full_name: string; primary_position: string; mlb_team: string | null } | null
  draft_pick?: { id: string; season_year: number; round: number; original_team: { id: string; name: string; abbreviation: string } } | null
}

interface Trade {
  id: string
  status: string
  notes: string | null
  proposed_at: string
  responded_at: string | null
  executed_at: string | null
  counter_of: string | null
  proposing_team: Team
  receiving_team: Team
  trade_items: TradeItem[]
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  accepted:  'bg-blue-900/40 text-blue-300 border-blue-800',
  completed: 'bg-green-900/40 text-green-300 border-green-800',
  rejected:  'bg-red-900/40 text-red-300 border-red-800',
  cancelled: 'bg-gray-800 text-gray-500 border-gray-700',
  countered: 'bg-purple-900/40 text-purple-300 border-purple-800',
  vetoed:    'bg-orange-900/40 text-orange-300 border-orange-800',
}

function pickLabel(pick: { season_year: number; round: number; original_team: { abbreviation: string } }) {
  return `${pick.season_year} Rd ${pick.round} (${pick.original_team.abbreviation})`
}

function TradeItemLine({ item, myTeamId }: { item: TradeItem; myTeamId: string }) {
  const giving = item.from_team.id === myTeamId
  const arrow = giving ? '→ to ' : '← from '
  const other = giving ? item.to_team.name : item.from_team.name

  let label = ''
  if (item.item_type === 'player' && item.player) {
    label = `${item.player.full_name} (${item.player.primary_position})`
  } else if (item.item_type === 'draft_pick' && item.draft_pick) {
    label = pickLabel(item.draft_pick)
  } else if (item.item_type === 'cash') {
    label = `$${Number(item.cash_amount).toFixed(0)} cash`
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
      giving ? 'bg-red-900/30 border-red-800 text-red-300' : 'bg-green-900/30 border-green-800 text-green-300'
    }`}>
      {giving ? '↑' : '↓'} {label} {arrow}{other}
    </span>
  )
}

function TradeCard({
  trade,
  myTeam,
  isCommissioner,
  onAction,
  onCounter,
}: {
  trade: Trade
  myTeam: Team
  isCommissioner: boolean
  onAction: (tradeId: string, action: string) => Promise<void>
  onCounter: (trade: Trade) => void
}) {
  const [loading, setLoading] = useState(false)
  const isProposer = trade.proposing_team.id === myTeam.id
  const isReceiver = trade.receiving_team.id === myTeam.id
  const partner = isProposer ? trade.receiving_team : trade.proposing_team

  async function act(action: string) {
    setLoading(true)
    await onAction(trade.id, action)
    setLoading(false)
  }

  const myItems = trade.trade_items.filter(i => i.from_team.id === myTeam.id)
  const theirItems = trade.trade_items.filter(i => i.from_team.id === partner.id)

  return (
    <div className={`border rounded-xl overflow-hidden ${
      trade.status === 'pending' && (isProposer || isReceiver)
        ? 'border-yellow-800/60'
        : 'border-gray-800'
    }`}>
      {/* Header */}
      <div className="px-5 py-3 bg-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">
            {trade.proposing_team.name} ↔ {trade.receiving_team.name}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[trade.status] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
            {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(trade.proposed_at).toLocaleDateString()}
        </span>
      </div>

      {/* Items */}
      <div className="px-5 py-4 bg-gray-900/50 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{trade.proposing_team.name} sends</p>
          <div className="space-y-1">
            {trade.trade_items.filter(i => i.from_team.id === trade.proposing_team.id).map(item => {
              let label = ''
              if (item.item_type === 'player' && item.player) label = `${item.player.full_name} (${item.player.primary_position})`
              else if (item.item_type === 'draft_pick' && item.draft_pick) label = pickLabel(item.draft_pick)
              else if (item.item_type === 'cash') label = `$${Number(item.cash_amount).toFixed(0)} cash`
              return <p key={item.id} className="text-sm text-white">{label}</p>
            })}
            {trade.trade_items.filter(i => i.from_team.id === trade.proposing_team.id).length === 0 && (
              <p className="text-xs text-gray-600">Nothing</p>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{trade.receiving_team.name} sends</p>
          <div className="space-y-1">
            {trade.trade_items.filter(i => i.from_team.id === trade.receiving_team.id).map(item => {
              let label = ''
              if (item.item_type === 'player' && item.player) label = `${item.player.full_name} (${item.player.primary_position})`
              else if (item.item_type === 'draft_pick' && item.draft_pick) label = pickLabel(item.draft_pick)
              else if (item.item_type === 'cash') label = `$${Number(item.cash_amount).toFixed(0)} cash`
              return <p key={item.id} className="text-sm text-white">{label}</p>
            })}
            {trade.trade_items.filter(i => i.from_team.id === trade.receiving_team.id).length === 0 && (
              <p className="text-xs text-gray-600">Nothing</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {trade.notes && (
        <div className="px-5 py-2 bg-gray-900/50 border-t border-gray-800">
          <p className="text-xs text-gray-400 italic">&ldquo;{trade.notes}&rdquo;</p>
        </div>
      )}

      {/* Actions */}
      {trade.status === 'pending' && (
        <div className="px-5 py-3 bg-gray-900 border-t border-gray-800 flex items-center gap-2 flex-wrap">
          {isReceiver && (
            <>
              <button
                onClick={() => act('accept')}
                disabled={loading}
                className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onCounter(trade)}
                disabled={loading}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                Counter
              </button>
              <button
                onClick={() => act('reject')}
                disabled={loading}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                Reject
              </button>
            </>
          )}
          {isProposer && (
            <button
              onClick={() => act('cancel')}
              disabled={loading}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              Cancel
            </button>
          )}
          {isCommissioner && !isProposer && !isReceiver && (
            <button
              onClick={() => act('veto')}
              disabled={loading}
              className="px-4 py-1.5 bg-orange-800 hover:bg-orange-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              Veto
            </button>
          )}
          {isCommissioner && (isProposer || isReceiver) && (
            <button
              onClick={() => act('veto')}
              disabled={loading}
              className="ml-auto px-3 py-1 text-xs bg-orange-900/50 hover:bg-orange-800 border border-orange-800 rounded-lg text-orange-300 transition-colors"
            >
              Veto (commissioner)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function TradeCenter({
  leagueId,
  myTeam,
  allTeams,
  myRoster,
  myPicks,
  cashSentThisSeason,
  cashLimit,
  trades,
  isCommissioner,
  currentUserId,
}: {
  leagueId: string
  myTeam: Team
  allTeams: Team[]
  myRoster: RosterPlayer[]
  myPicks: DraftPick[]
  cashSentThisSeason: number
  cashLimit: number
  trades: Trade[]
  isCommissioner: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showProposer, setShowProposer] = useState(false)
  const [counterTrade, setCounterTrade] = useState<Trade | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pendingIncoming = trades.filter(t => t.status === 'pending' && t.receiving_team.id === myTeam.id)
  const pendingOutgoing = trades.filter(t => t.status === 'pending' && t.proposing_team.id === myTeam.id)
  const settled = trades.filter(t => !['pending'].includes(t.status))

  async function handleAction(tradeId: string, action: string) {
    setError(null)
    setSuccess(null)
    const res = await fetch(`/api/leagues/${leagueId}/trades/${tradeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
    } else {
      setSuccess(
        action === 'accept' ? 'Trade accepted and executed!' :
        action === 'reject' ? 'Trade rejected.' :
        action === 'cancel' ? 'Trade cancelled.' :
        'Trade vetoed.'
      )
      startTransition(() => router.refresh())
    }
  }

  function handleCounter(trade: Trade) {
    setCounterTrade(trade)
    setShowProposer(true)
  }

  function handleProposerClose() {
    setShowProposer(false)
    setCounterTrade(null)
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

      {/* Propose Trade button / form */}
      {!showProposer ? (
        <button
          onClick={() => setShowProposer(true)}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition-colors"
        >
          + Propose Trade
        </button>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white">
              {counterTrade ? `Counter Offer to ${counterTrade.proposing_team.name}` : 'Propose a Trade'}
            </h3>
            <button
              onClick={handleProposerClose}
              className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
          <div className="p-5">
            <TradeProposer
              leagueId={leagueId}
              myTeam={myTeam}
              allTeams={allTeams}
              myRoster={myRoster}
              myPicks={myPicks}
              cashSentThisSeason={cashSentThisSeason}
              cashLimit={cashLimit}
              counterTrade={counterTrade}
              onSuccess={() => {
                handleProposerClose()
                setSuccess('Trade proposal sent!')
                startTransition(() => router.refresh())
              }}
              onError={(msg) => setError(msg)}
            />
          </div>
        </div>
      )}

      {/* Incoming pending trades */}
      {pendingIncoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-yellow-300">
            Incoming Offers ({pendingIncoming.length})
          </h2>
          {pendingIncoming.map(t => (
            <TradeCard
              key={t.id}
              trade={t}
              myTeam={myTeam}
              isCommissioner={isCommissioner}
              onAction={handleAction}
              onCounter={handleCounter}
            />
          ))}
        </div>
      )}

      {/* Outgoing pending trades */}
      {pendingOutgoing.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-white">
            My Pending Offers ({pendingOutgoing.length})
          </h2>
          {pendingOutgoing.map(t => (
            <TradeCard
              key={t.id}
              trade={t}
              myTeam={myTeam}
              isCommissioner={isCommissioner}
              onAction={handleAction}
              onCounter={handleCounter}
            />
          ))}
        </div>
      )}

      {/* Settled trades */}
      {settled.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-400">Trade History</h2>
          {settled.map(t => (
            <TradeCard
              key={t.id}
              trade={t}
              myTeam={myTeam}
              isCommissioner={isCommissioner}
              onAction={handleAction}
              onCounter={handleCounter}
            />
          ))}
        </div>
      )}

      {trades.length === 0 && !showProposer && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500">
          <p>No trades yet. Propose one to get started.</p>
        </div>
      )}
    </div>
  )
}
