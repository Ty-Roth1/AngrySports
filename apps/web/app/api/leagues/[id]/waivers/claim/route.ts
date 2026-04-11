import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// DELETE /api/leagues/[id]/waivers/claim — cancel a pending claim
// Body: { claim_id: string }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { claim_id } = body
  if (!claim_id) return NextResponse.json({ error: 'claim_id required' }, { status: 400 })

  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .single()
  if (!myTeam) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('waiver_claims')
    .update({ status: 'cancelled' })
    .eq('id', claim_id)
    .eq('team_id', myTeam.id)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/leagues/[id]/waivers/claim
// Body: { player_add_id, player_drop_id?, bid_amount }
// Submits a FAAB waiver claim (or free agent pickup for non-FAAB leagues).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { player_add_id, player_drop_id, bid_amount = 0 } = body

  if (!player_add_id) return NextResponse.json({ error: 'player_add_id is required' }, { status: 400 })

  // Get my team + league settings
  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id, faab_remaining')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .single()
  if (!myTeam) return NextResponse.json({ error: 'You are not in this league' }, { status: 403 })

  const { data: settings } = await supabase
    .from('league_settings')
    .select('waiver_type, faab_budget, waiver_period_days')
    .eq('league_id', leagueId)
    .single()

  const waiverType = settings?.waiver_type ?? 'standard'
  const isFaab = waiverType === 'faab'
  const isOpenFa = waiverType === 'none'

  // Validate FAAB bid
  if (isFaab) {
    if (bid_amount < 0) return NextResponse.json({ error: 'Bid must be non-negative' }, { status: 400 })
    if (bid_amount > myTeam.faab_remaining) {
      return NextResponse.json(
        { error: `Bid ($${bid_amount}) exceeds your FAAB remaining ($${myTeam.faab_remaining})` },
        { status: 422 }
      )
    }
  }

  // Confirm player is not already on a roster in this league
  const { data: allTeams } = await supabase.from('fantasy_teams').select('id').eq('league_id', leagueId)
  const teamIds = allTeams?.map(t => t.id) ?? []

  const { data: existingRoster } = await supabase
    .from('rosters')
    .select('id')
    .eq('player_id', player_add_id)
    .in('team_id', teamIds)
    .maybeSingle()

  if (existingRoster) {
    return NextResponse.json({ error: 'Player is already on a roster in this league' }, { status: 422 })
  }

  // --- Open free agency (waiver_type = 'none'): add immediately ---
  if (isOpenFa) {
    const admin = createAdminClient()

    // Drop player if requested
    if (player_drop_id) {
      await admin.from('rosters').delete().eq('team_id', myTeam.id).eq('player_id', player_drop_id)
    }

    // Add player to bench
    const { error: rosterErr } = await admin.from('rosters').insert({
      team_id: myTeam.id,
      player_id: player_add_id,
      slot_type: 'BENCH',
    })
    if (rosterErr) return NextResponse.json({ error: rosterErr.message }, { status: 500 })

    // Record transaction
    const { data: txn } = await admin.from('transactions').insert({
      league_id: leagueId,
      initiated_by_team_id: myTeam.id,
      type: 'add',
      status: 'completed',
      processed_at: new Date().toISOString(),
    }).select('id').single()

    if (txn) {
      const items: any[] = [{ transaction_id: txn.id, player_id: player_add_id, from_team_id: null, to_team_id: myTeam.id }]
      if (player_drop_id) {
        items.push({ transaction_id: txn.id, player_id: player_drop_id, from_team_id: myTeam.id, to_team_id: null })
      }
      await admin.from('transaction_items').insert(items)
    }

    return NextResponse.json({ added: true, message: 'Player added to your roster.' })
  }

  // --- Standard / FAAB waivers: create pending claim ---

  // Check for duplicate pending claim by this team for this player
  const { data: dupClaim } = await supabase
    .from('waiver_claims')
    .select('id')
    .eq('league_id', leagueId)
    .eq('team_id', myTeam.id)
    .eq('player_add_id', player_add_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (dupClaim) {
    return NextResponse.json({ error: 'You already have a pending claim for this player' }, { status: 422 })
  }

  // Calculate process date
  const processDate = new Date()
  if (isFaab) {
    processDate.setDate(processDate.getDate() + (settings?.waiver_period_days ?? 2))
  }

  const { data: claim, error } = await supabase
    .from('waiver_claims')
    .insert({
      league_id: leagueId,
      team_id: myTeam.id,
      player_add_id,
      player_drop_id: player_drop_id ?? null,
      bid_amount: isFaab ? bid_amount : 0,
      status: 'pending',
      process_date: processDate.toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ claim })
}
