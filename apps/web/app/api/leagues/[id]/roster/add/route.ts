import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/roster/add
// Commissioner only. Adds a free agent directly to any team's roster.
// Body: { player_id: string, team_id: string, slot_type?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Must be commissioner or co-commissioner
  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id, co_commissioner_id')
    .eq('id', leagueId)
    .single()
  const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
  if (!isCommish) return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })

  const body = await request.json()
  const { player_id, team_id, slot_type = 'BENCH' } = body

  if (!player_id || !team_id) {
    return NextResponse.json({ error: 'player_id and team_id are required' }, { status: 400 })
  }

  // Verify team is in this league
  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('id', team_id)
    .eq('league_id', leagueId)
    .single()
  if (!team) return NextResponse.json({ error: 'Team not in this league' }, { status: 404 })

  // Check player is not already rostered
  const { data: allTeams } = await supabase.from('fantasy_teams').select('id').eq('league_id', leagueId)
  const teamIds = allTeams?.map(t => t.id) ?? []
  const { data: existing } = await supabase
    .from('rosters')
    .select('id')
    .eq('player_id', player_id)
    .in('team_id', teamIds)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Player is already on a roster in this league' }, { status: 422 })

  const admin = createAdminClient()

  const { error: rosterErr } = await admin.from('rosters').insert({
    team_id,
    player_id,
    slot_type,
    acquisition_type: 'commissioner',
    acquired_at: new Date().toISOString(),
  })
  if (rosterErr) return NextResponse.json({ error: rosterErr.message }, { status: 500 })

  // Log transaction
  const { data: txn } = await admin.from('transactions').insert({
    league_id: leagueId,
    type: 'add',
    status: 'completed',
    initiated_by_team_id: team_id,
    notes: 'Commissioner add',
    processed_at: new Date().toISOString(),
  }).select('id').single()

  if (txn) {
    await admin.from('transaction_items').insert({
      transaction_id: txn.id,
      player_id,
      from_team_id: null,
      to_team_id: team_id,
    })
  }

  return NextResponse.json({ ok: true })
}
