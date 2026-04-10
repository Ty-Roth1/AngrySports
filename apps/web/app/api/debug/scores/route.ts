import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/debug/scores?league_id=xxx&date=YYYY-MM-DD
// Diagnostic: shows what the scoring pipeline finds in the DB.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('league_id')
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const admin = createAdminClient()

  // 1. Count all matchups
  const { data: allMatchups, error: matchupErr } = await admin
    .from('matchups')
    .select('id, league_id, status, period_start, period_end, home_score, away_score')
    .order('period_start', { ascending: false })
    .limit(10)

  // 2. Count all player_game_scores
  const { count: scoreCount } = await admin
    .from('player_game_scores')
    .select('*', { count: 'exact', head: true })

  // 3. Recent player_game_scores
  const { data: recentScores } = await admin
    .from('player_game_scores')
    .select('player_id, team_id, matchup_id, game_date, fantasy_points, mlb_game_id')
    .order('game_date', { ascending: false })
    .limit(10)

  // 4. If league_id given, check that league's matchups and scores
  let leagueMatchups = null
  let leagueScores = null
  if (leagueId) {
    const { data: lm } = await admin
      .from('matchups')
      .select('id, status, period_start, period_end, home_team_id, away_team_id, home_score, away_score')
      .eq('league_id', leagueId)
      .order('period_start', { ascending: false })
      .limit(5)
    leagueMatchups = lm

    if (lm && lm.length > 0) {
      const matchupId = lm[0].id
      const { data: ls } = await admin
        .from('player_game_scores')
        .select('player_id, team_id, game_date, fantasy_points, mlb_game_id')
        .eq('matchup_id', matchupId)
        .limit(20)
      leagueScores = ls
    }
  }

  // 5. Check if 'rank' column exists on players
  const { data: playerSample } = await admin
    .from('players')
    .select('id, full_name, status, is_second_year')
    .limit(1)

  return NextResponse.json({
    date,
    totalScoreRows: scoreCount,
    recentScores,
    allMatchups,
    matchupError: matchupErr?.message,
    leagueMatchups,
    leagueScores,
    playerColumnsOk: playerSample !== null,
    playerSample,
  })
}
