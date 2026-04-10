import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/contracts
// Body: { player_id, team_id, salary, years_total, years_remaining, expires_after_season, contract_type }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { player_id, team_id, salary, years_total, years_remaining, expires_after_season, contract_type } = body

  if (!player_id || !team_id || salary == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Auth: must be team owner or commissioner
  const { data: team } = await admin
    .from('fantasy_teams')
    .select('owner_id, league_id')
    .eq('id', team_id)
    .single()

  if (!team || team.league_id !== leagueId) {
    return NextResponse.json({ error: 'Team not found in this league' }, { status: 404 })
  }

  if (team.owner_id !== user.id) {
    const { data: league } = await admin
      .from('leagues')
      .select('commissioner_id, co_commissioner_id')
      .eq('id', leagueId)
      .single()
    const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
    if (!isCommish) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Void any existing active contract for this player in this league
  await admin
    .from('contracts')
    .update({ voided_at: new Date().toISOString() })
    .eq('player_id', player_id)
    .eq('league_id', leagueId)
    .is('voided_at', null)

  const { data, error } = await admin.from('contracts').insert({
    league_id: leagueId,
    team_id,
    player_id,
    salary: Number(salary),
    years_total: Number(years_total ?? 1),
    years_remaining: Number(years_remaining ?? 1),
    expires_after_season: Number(expires_after_season),
    contract_type: contract_type ?? 'standard',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
