import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/scoring/finalize
// Marks all matchups whose period_end < today as 'final' and
// recomputes wins / losses / ties / points_for for every affected team.
// Called by the Monday 07:00 UTC cron (= midnight PT) and can be
// triggered manually from the admin panel.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const apiSecret = process.env.SCORING_SYNC_SECRET

  // If a secret is configured, require it. If not set, allow through (dev / admin panel use).
  if (apiSecret && authHeader !== `Bearer ${apiSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // Find every matchup that has ended but hasn't been finalized yet
  const { data: expiredMatchups } = await supabase
    .from('matchups')
    .select('id, league_id, home_team_id, away_team_id, home_score, away_score, period_end')
    .in('status', ['active', 'upcoming'])
    .lt('period_end', today)

  if (!expiredMatchups || expiredMatchups.length === 0) {
    return NextResponse.json({ finalized: 0, message: 'No expired matchups to finalize' })
  }

  // Mark them all final
  const expiredIds = expiredMatchups.map(m => m.id)
  await supabase
    .from('matchups')
    .update({ status: 'final' })
    .in('id', expiredIds)

  // Collect every team affected
  const affectedTeamIds = new Set<string>()
  for (const m of expiredMatchups) {
    affectedTeamIds.add(m.home_team_id)
    affectedTeamIds.add(m.away_team_id)
  }

  // Recompute standings for each affected team from all their final matchups
  for (const teamId of affectedTeamIds) {
    const { data: allMatchups } = await supabase
      .from('matchups')
      .select('home_team_id, away_team_id, home_score, away_score, status')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'final')

    let wins = 0, losses = 0, ties = 0, pointsFor = 0
    for (const m of allMatchups ?? []) {
      const myScore  = m.home_team_id === teamId ? Number(m.home_score) : Number(m.away_score)
      const oppScore = m.home_team_id === teamId ? Number(m.away_score) : Number(m.home_score)
      pointsFor += myScore
      if (myScore > oppScore) wins++
      else if (myScore < oppScore) losses++
      else ties++
    }

    await supabase.from('fantasy_teams').update({
      wins,
      losses,
      ties,
      points_for: Math.round(pointsFor * 100) / 100,
    }).eq('id', teamId)
  }

  return NextResponse.json({
    finalized: expiredMatchups.length,
    teams_updated: affectedTeamIds.size,
    matchup_ids: expiredIds,
  })
}
