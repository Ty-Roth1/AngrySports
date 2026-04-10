import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/leagues/[id]/draft-picks?team_id=xxx&season_year=2026
// Returns draft picks for the league (optionally filtered by team / year)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get('team_id')
  const seasonYear = searchParams.get('season_year')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = supabase
    .from('draft_picks')
    .select(`
      id, season_year, round, used,
      original_team:original_team_id (id, name, abbreviation),
      current_team:current_team_id (id, name, abbreviation)
    `)
    .eq('league_id', leagueId)
    .eq('used', false)
    .order('season_year')
    .order('round')

  if (teamId) query = query.eq('current_team_id', teamId)
  if (seasonYear) query = query.eq('season_year', Number(seasonYear))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ picks: data ?? [] })
}

// POST /api/leagues/[id]/draft-picks
// Commissioner only. Generates picks for a season.
// Body: { season_year: number, rounds: number }
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
    .select('commissioner_id, co_commissioner_id')
    .eq('id', leagueId)
    .single()

  const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
  if (!isCommish) return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })

  const body = await request.json()
  const { season_year, rounds = 5 } = body
  if (!season_year) return NextResponse.json({ error: 'season_year required' }, { status: 400 })

  const admin = createAdminClient()

  // Get all teams in the league
  const { data: teams } = await admin
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)

  if (!teams || teams.length === 0) {
    return NextResponse.json({ error: 'No teams in league' }, { status: 422 })
  }

  // Generate picks: one per team per round
  const picks = []
  for (let round = 1; round <= rounds; round++) {
    for (const team of teams) {
      picks.push({
        league_id: leagueId,
        season_year,
        round,
        original_team_id: team.id,
        current_team_id: team.id,
        used: false,
      })
    }
  }

  // Upsert (idempotent)
  const { error } = await admin
    .from('draft_picks')
    .upsert(picks, { onConflict: 'league_id,season_year,round,original_team_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    generated: picks.length,
    message: `Generated ${rounds} rounds × ${teams.length} teams = ${picks.length} picks for ${season_year}`,
  })
}
