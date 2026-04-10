import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// PATCH /api/leagues/[id]/trades/[tradeId]
// Body: { action: 'accept' | 'reject' | 'cancel' | 'veto' }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; tradeId: string }> }
) {
  const { id: leagueId, tradeId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action } = body

  if (!['accept', 'reject', 'cancel', 'veto'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept, reject, cancel, or veto' }, { status: 400 })
  }

  // Load trade with items
  const { data: trade } = await supabase
    .from('trades')
    .select(`
      id, status, league_id, proposing_team_id, receiving_team_id,
      trade_items (id, item_type, player_id, draft_pick_id, cash_amount, from_team_id, to_team_id)
    `)
    .eq('id', tradeId)
    .eq('league_id', leagueId)
    .single()

  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
  if (trade.status !== 'pending') {
    return NextResponse.json({ error: `Trade is already ${trade.status}` }, { status: 422 })
  }

  // Load user's team and league
  const [{ data: myTeam }, { data: league }] = await Promise.all([
    supabase.from('fantasy_teams').select('id').eq('league_id', leagueId).eq('owner_id', user.id).single(),
    supabase.from('leagues').select('commissioner_id, co_commissioner_id').eq('id', leagueId).single(),
  ])

  const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
  const isProposer = myTeam?.id === trade.proposing_team_id
  const isReceiver = myTeam?.id === trade.receiving_team_id

  // Authorization checks per action
  if (action === 'cancel' && !isProposer && !isCommish) {
    return NextResponse.json({ error: 'Only the proposing team or commissioner can cancel' }, { status: 403 })
  }
  if (action === 'reject' && !isReceiver && !isCommish) {
    return NextResponse.json({ error: 'Only the receiving team or commissioner can reject' }, { status: 403 })
  }
  if (action === 'accept' && !isReceiver) {
    return NextResponse.json({ error: 'Only the receiving team can accept' }, { status: 403 })
  }
  if (action === 'veto' && !isCommish) {
    return NextResponse.json({ error: 'Only the commissioner can veto' }, { status: 403 })
  }

  const now = new Date().toISOString()

  if (action === 'cancel') {
    await supabase.from('trades').update({ status: 'cancelled', responded_at: now }).eq('id', tradeId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    await supabase.from('trades').update({ status: 'rejected', responded_at: now }).eq('id', tradeId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'veto') {
    await supabase.from('trades').update({ status: 'vetoed', responded_at: now }).eq('id', tradeId)
    return NextResponse.json({ ok: true })
  }

  // ACCEPT — execute the trade using admin client
  const admin = createAdminClient()

  const items = trade.trade_items as any[]

  // Execute each item
  for (const item of items) {
    if (item.item_type === 'player') {
      // Move player from source roster to destination, reset slot to BENCH
      const { error: rosterErr } = await admin
        .from('rosters')
        .update({ team_id: item.to_team_id, slot_type: 'BENCH' })
        .eq('player_id', item.player_id)
        .eq('team_id', item.from_team_id)

      if (rosterErr) {
        return NextResponse.json({ error: `Failed to move player: ${rosterErr.message}` }, { status: 500 })
      }
    }

    if (item.item_type === 'draft_pick') {
      const { error: pickErr } = await admin
        .from('draft_picks')
        .update({ current_team_id: item.to_team_id })
        .eq('id', item.draft_pick_id)

      if (pickErr) {
        return NextResponse.json({ error: `Failed to transfer pick: ${pickErr.message}` }, { status: 500 })
      }
    }

    // Cash: no DB update needed — tracked via completed trade_items
  }

  // Mark trade as completed
  await admin
    .from('trades')
    .update({ status: 'completed', responded_at: now, executed_at: now })
    .eq('id', tradeId)

  // Record in transactions
  const { data: txn } = await admin
    .from('transactions')
    .insert({
      league_id: leagueId,
      team_id: trade.proposing_team_id,
      type: 'trade',
      status: 'completed',
      executed_at: now,
    })
    .select('id')
    .single()

  if (txn) {
    const txnItems: any[] = []
    for (const item of items) {
      if (item.item_type === 'player') {
        txnItems.push({
          transaction_id: txn.id,
          player_id: item.player_id,
          action: 'trade',
          team_id: item.to_team_id,
        })
      }
    }
    if (txnItems.length > 0) {
      await admin.from('transaction_items').insert(txnItems)
    }
  }

  return NextResponse.json({ ok: true, message: 'Trade completed successfully.' })
}
