import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const excludeLeagueId = searchParams.get('exclude_drafted_league')

  if (q.length < 2) return NextResponse.json({ players: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find players already on a roster in this league
  let draftedPlayerIds: string[] = []
  if (excludeLeagueId) {
    const { data: rosters } = await supabase
      .from('rosters')
      .select('player_id, fantasy_teams!inner(league_id)')
      .eq('fantasy_teams.league_id', excludeLeagueId)
    draftedPlayerIds = rosters?.map(r => r.player_id) ?? []
  }

  let query = supabase
    .from('players')
    .select('id, mlb_id, full_name, primary_position, eligible_positions, mlb_team, is_rookie, status')
    .ilike('full_name', `%${q}%`)
    .neq('status', 'inactive')
    .order('full_name')
    .limit(20)

  if (draftedPlayerIds.length > 0) {
    query = query.not('id', 'in', `(${draftedPlayerIds.join(',')})`)
  }

  const { data: players, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ players: players ?? [] })
}
