import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/leagues/[id]/free-agents?q=name
// Returns players not rostered in this league matching the search term.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const pos = searchParams.get('pos') ?? ''

  // Get all rostered player IDs
  const { data: allTeams } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)
  const teamIds = allTeams?.map(t => t.id) ?? []

  let rosteredIds: string[] = []
  if (teamIds.length > 0) {
    const { data: rosters } = await supabase
      .from('rosters')
      .select('player_id')
      .in('team_id', teamIds)
    rosteredIds = rosters?.map(r => r.player_id) ?? []
  }

  let query = supabase
    .from('players')
    .select('id, full_name, primary_position, mlb_team, status')
    .neq('status', 'inactive')
    .order('status')
    .order('full_name')
    .limit(30)

  if (rosteredIds.length > 0) query = query.not('id', 'in', `(${rosteredIds.join(',')})`)
  if (q) query = query.ilike('full_name', `%${q}%`)
  if (pos) query = query.eq('primary_position', pos)

  const { data } = await query
  return NextResponse.json(data ?? [])
}
