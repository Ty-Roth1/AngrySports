import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — record a draft pick (offline mode: commissioner enters manually)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id, is_contract_league, season_year')
    .eq('id', leagueId)
    .single()

  if (!league || league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { draft_id, team_id, player_id, pick_number, round, bid_amount, contract_years } = body

  if (!draft_id || !team_id || !player_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Record the draft pick
  const { data: pick, error: pickError } = await supabase
    .from('draft_picks')
    .insert({
      draft_id,
      team_id,
      player_id,
      pick_number: pick_number ?? 1,
      round: round ?? 1,
      bid_amount: bid_amount ?? null,
      nominated_by_team_id: null,
    })
    .select()
    .single()

  if (pickError) return NextResponse.json({ error: pickError.message }, { status: 500 })

  // 2. Add player to roster
  const { error: rosterError } = await supabase
    .from('rosters')
    .insert({
      team_id,
      player_id,
      slot_type: 'BENCH',
      acquisition_type: 'draft',
    })

  if (rosterError) return NextResponse.json({ error: rosterError.message }, { status: 500 })

  // 3. Create contract if this is a contract league
  if (league.is_contract_league && bid_amount != null) {
    const years = contract_years ?? 1
    await supabase.from('contracts').insert({
      league_id: leagueId,
      team_id,
      player_id,
      years_total: years,
      years_remaining: years,
      salary: bid_amount,
      contract_type: 'standard',
      expires_after_season: league.season_year + years - 1,
    })
  }

  // 4. Record as a transaction
  const { data: txn } = await supabase
    .from('transactions')
    .insert({
      league_id: leagueId,
      type: 'add',
      status: 'completed',
      initiated_by_team_id: team_id,
      notes: `Draft pick`,
    })
    .select()
    .single()

  if (txn) {
    await supabase.from('transaction_items').insert({
      transaction_id: txn.id,
      player_id,
      from_team_id: null,
      to_team_id: team_id,
    })
  }

  return NextResponse.json({ pick })
}
