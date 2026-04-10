import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/roster/drop
// Body: { player_id: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { player_id, team_id: targetTeamId } = body

  if (!player_id) return NextResponse.json({ error: 'Missing player_id' }, { status: 400 })

  // Determine acting team:
  // - If team_id provided, must be commissioner
  // - Otherwise, use requesting user's own team
  let teamId: string

  if (targetTeamId) {
    // Commissioner drop on behalf of another team
    const { data: league } = await supabase
      .from('leagues')
      .select('commissioner_id, co_commissioner_id')
      .eq('id', leagueId)
      .single()
    const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
    if (!isCommish) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    teamId = targetTeamId
  } else {
    // Owner drop their own player
    const { data: myTeam } = await supabase
      .from('fantasy_teams')
      .select('id')
      .eq('league_id', leagueId)
      .eq('owner_id', user.id)
      .single()
    if (!myTeam) return NextResponse.json({ error: 'You are not in this league' }, { status: 403 })
    teamId = myTeam.id
  }

  // Verify player is on the target team's roster
  const { data: rosterEntry } = await supabase
    .from('rosters')
    .select('id, slot_type')
    .eq('team_id', teamId)
    .eq('player_id', player_id)
    .single()

  if (!rosterEntry) return NextResponse.json({ error: 'Player not on that roster' }, { status: 404 })

  // Remove from roster
  const { error: dropError } = await supabase
    .from('rosters')
    .delete()
    .eq('id', rosterEntry.id)

  if (dropError) return NextResponse.json({ error: dropError.message }, { status: 500 })

  // Void any active contract for this player in this league
  await supabase
    .from('contracts')
    .update({ voided_at: new Date().toISOString() })
    .eq('league_id', leagueId)
    .eq('player_id', player_id)
    .is('voided_at', null)

  // Record transaction
  const { data: txn } = await supabase
    .from('transactions')
    .insert({
      league_id: leagueId,
      type: 'drop',
      status: 'completed',
      initiated_by_team_id: teamId,
      notes: 'Player dropped',
      processed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (txn) {
    await supabase.from('transaction_items').insert({
      transaction_id: txn.id,
      player_id,
      from_team_id: teamId,
      to_team_id: null,
    })
  }

  return NextResponse.json({ ok: true })
}
