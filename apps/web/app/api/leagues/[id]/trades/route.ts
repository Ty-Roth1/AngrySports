import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/leagues/[id]/trades
// Returns all trades for the league (any team can see all trades for transparency)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trades, error } = await supabase
    .from('trades')
    .select(`
      id, status, notes, proposed_at, responded_at, executed_at, counter_of,
      proposing_team:proposing_team_id (id, name, abbreviation),
      receiving_team:receiving_team_id (id, name, abbreviation),
      trade_items (
        id, item_type, cash_amount,
        from_team:from_team_id (id, name),
        to_team:to_team_id (id, name),
        player:player_id (id, full_name, primary_position, mlb_team),
        draft_pick:draft_pick_id (
          id, season_year, round,
          original_team:original_team_id (id, name, abbreviation)
        )
      )
    `)
    .eq('league_id', leagueId)
    .order('proposed_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ trades: trades ?? [] })
}

// POST /api/leagues/[id]/trades
// Propose a new trade.
// Body: {
//   receiving_team_id: string,
//   notes?: string,
//   items: Array<{
//     item_type: 'player' | 'draft_pick' | 'cash',
//     player_id?: string,
//     draft_pick_id?: string,
//     cash_amount?: number,
//     from_team_id: string,
//     to_team_id: string,
//   }>
// }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user has a team
  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id, name')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .single()
  if (!myTeam) return NextResponse.json({ error: 'You are not in this league' }, { status: 403 })

  const body = await request.json()
  const { receiving_team_id, notes, items, counter_of } = body

  if (!receiving_team_id) return NextResponse.json({ error: 'receiving_team_id required' }, { status: 400 })
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Trade must include at least one item' }, { status: 400 })
  }

  // Verify receiving team is in the league
  const { data: receivingTeam } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('id', receiving_team_id)
    .eq('league_id', leagueId)
    .single()
  if (!receivingTeam) return NextResponse.json({ error: 'Receiving team not found in this league' }, { status: 404 })

  // Validate items
  const validTeamIds = [myTeam.id, receiving_team_id]
  for (const item of items) {
    if (!['player', 'draft_pick', 'cash'].includes(item.item_type)) {
      return NextResponse.json({ error: `Invalid item_type: ${item.item_type}` }, { status: 400 })
    }
    if (!validTeamIds.includes(item.from_team_id) || !validTeamIds.includes(item.to_team_id)) {
      return NextResponse.json({ error: 'Trade items must be between the two teams' }, { status: 400 })
    }
    if (item.from_team_id === item.to_team_id) {
      return NextResponse.json({ error: 'Cannot trade an item to yourself' }, { status: 400 })
    }
  }

  // Check cash limit
  const { data: settings } = await supabase
    .from('league_settings')
    .select('cash_trade_limit')
    .eq('league_id', leagueId)
    .single()
  const cashLimit = settings?.cash_trade_limit ?? 30

  const currentYear = new Date().getFullYear()

  // Sum cash already sent by my team this season (completed trades only)
  const { data: completedTrades } = await supabase
    .from('trades')
    .select('id')
    .eq('league_id', leagueId)
    .eq('status', 'completed')
    .or(`proposing_team_id.eq.${myTeam.id},receiving_team_id.eq.${myTeam.id}`)

  let cashAlreadySent = 0
  if (completedTrades && completedTrades.length > 0) {
    const { data: cashItems } = await supabase
      .from('trade_items')
      .select('cash_amount')
      .in('trade_id', completedTrades.map(t => t.id))
      .eq('from_team_id', myTeam.id)
      .eq('item_type', 'cash')
    cashAlreadySent = (cashItems ?? []).reduce((sum, i) => sum + (Number(i.cash_amount) || 0), 0)
  }

  const cashInThisTrade = items
    .filter((i: any) => i.item_type === 'cash' && i.from_team_id === myTeam.id)
    .reduce((sum: number, i: any) => sum + (Number(i.cash_amount) || 0), 0)

  if (cashAlreadySent + cashInThisTrade > cashLimit) {
    return NextResponse.json({
      error: `Cash limit exceeded. You can send at most $${cashLimit} per season. You've already sent $${cashAlreadySent.toFixed(2)}.`,
    }, { status: 422 })
  }

  // Verify my players/picks are actually mine
  const myPlayerIds = items.filter((i: any) => i.item_type === 'player' && i.from_team_id === myTeam.id).map((i: any) => i.player_id)
  if (myPlayerIds.length > 0) {
    const { data: myRoster } = await supabase
      .from('rosters')
      .select('player_id')
      .eq('team_id', myTeam.id)
      .in('player_id', myPlayerIds)
    const myRosterIds = (myRoster ?? []).map(r => r.player_id)
    for (const pid of myPlayerIds) {
      if (!myRosterIds.includes(pid)) {
        return NextResponse.json({ error: `Player ${pid} is not on your roster` }, { status: 422 })
      }
    }
  }

  const myPickIds = items.filter((i: any) => i.item_type === 'draft_pick' && i.from_team_id === myTeam.id).map((i: any) => i.draft_pick_id)
  if (myPickIds.length > 0) {
    const { data: myPicks } = await supabase
      .from('draft_picks')
      .select('id')
      .eq('current_team_id', myTeam.id)
      .eq('league_id', leagueId)
      .in('id', myPickIds)
    const myPickIdSet = new Set((myPicks ?? []).map(p => p.id))
    for (const pid of myPickIds) {
      if (!myPickIdSet.has(pid)) {
        return NextResponse.json({ error: `Draft pick ${pid} is not yours to trade` }, { status: 422 })
      }
    }
  }

  // Create the trade
  const { data: trade, error: tradeError } = await supabase
    .from('trades')
    .insert({
      league_id: leagueId,
      proposing_team_id: myTeam.id,
      receiving_team_id,
      status: 'pending',
      notes: notes?.trim() || null,
      counter_of: counter_of ?? null,
    })
    .select('id')
    .single()

  if (tradeError) return NextResponse.json({ error: tradeError.message }, { status: 500 })

  // Insert trade items
  const itemRows = items.map((item: any) => ({
    trade_id: trade.id,
    item_type: item.item_type,
    player_id: item.player_id ?? null,
    draft_pick_id: item.draft_pick_id ?? null,
    cash_amount: item.cash_amount ?? null,
    from_team_id: item.from_team_id,
    to_team_id: item.to_team_id,
  }))

  const { error: itemsError } = await supabase.from('trade_items').insert(itemRows)
  if (itemsError) {
    // Clean up trade if items failed
    await supabase.from('trades').delete().eq('id', trade.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // If this is a counter-offer, mark the original as countered
  if (counter_of) {
    await supabase
      .from('trades')
      .update({ status: 'countered', responded_at: new Date().toISOString() })
      .eq('id', counter_of)
  }

  return NextResponse.json({ trade_id: trade.id })
}
