import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateRoundRobin } from '@/lib/scoring'

// POST /api/leagues/[id]/schedule/generate
// Body: { start_date: 'YYYY-MM-DD', season_year?: number }
// Commissioner only. Creates schedule_weeks + matchup rows and activates the league.
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
    .select(`
      commissioner_id, regular_season_weeks, playoff_weeks,
      playoff_start_week, season_year,
      fantasy_teams (id)
    `)
    .eq('id', leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden — commissioner only' }, { status: 403 })
  }

  const body = await request.json()
  const { start_date } = body

  if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    return NextResponse.json({ error: 'start_date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const teamIds = (league.fantasy_teams as any[]).map(t => t.id)
  if (teamIds.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams to generate a schedule' }, { status: 400 })
  }

  const seasonYear = league.season_year
  const regularWeeks = league.regular_season_weeks ?? 21
  const playoffWeeks = league.playoff_weeks ?? 3
  const totalWeeks = regularWeeks + playoffWeeks

  // Shuffle teams for fairness (deterministic based on team count)
  const shuffled = [...teamIds].sort(() => 0.5 - Math.random())

  // Generate round-robin rounds
  const rounds = generateRoundRobin(shuffled)

  // Delete existing schedule for this league/season (idempotent regenerate)
  await supabase.from('schedule_weeks').delete().eq('league_id', leagueId).eq('season_year', seasonYear)
  await supabase.from('matchups').delete().eq('league_id', leagueId).eq('season_year', seasonYear)

  const scheduleWeeksToInsert = []
  const matchupsToInsert = []

  // Use noon UTC to avoid any timezone-induced date shifts
  const startDate = new Date(start_date + 'T12:00:00Z')

  // Week 1 ends on the Sunday of the start week (may be a short week)
  const dow = startDate.getUTCDay() // 0=Sun,1=Mon,...,6=Sat
  const daysToSunday = dow === 0 ? 0 : 7 - dow
  const week1End = new Date(startDate)
  week1End.setUTCDate(startDate.getUTCDate() + daysToSunday)

  for (let week = 1; week <= totalWeeks; week++) {
    let weekStart: Date, weekEnd: Date
    if (week === 1) {
      weekStart = startDate
      weekEnd = week1End
    } else {
      // Week 2 starts the Monday after week 1 ends, each subsequent week is +7 days
      weekStart = new Date(week1End)
      weekStart.setUTCDate(week1End.getUTCDate() + (week - 2) * 7 + 1)
      weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
    }

    const isPlayoff = week > regularWeeks
    const periodStart = weekStart.toISOString().split('T')[0]
    const periodEnd = weekEnd.toISOString().split('T')[0]

    scheduleWeeksToInsert.push({
      league_id: leagueId,
      week,
      season_year: seasonYear,
      period_start: periodStart,
      period_end: periodEnd,
      is_playoff: isPlayoff,
    })

    // Pick the round for this week (cycle through rounds)
    const roundIndex = (week - 1) % rounds.length
    const pairs = rounds[roundIndex]

    // Flip home/away on second pass of the schedule for variety
    const flip = (week - 1) >= rounds.length

    for (const [home, away] of pairs) {
      matchupsToInsert.push({
        league_id: leagueId,
        season_year: seasonYear,
        week,
        home_team_id: flip ? away : home,
        away_team_id: flip ? home : away,
        home_score: 0,
        away_score: 0,
        status: 'upcoming',
        is_playoff: isPlayoff,
        period_start: periodStart,
        period_end: periodEnd,
      })
    }
  }

  const { error: swErr } = await supabase.from('schedule_weeks').insert(scheduleWeeksToInsert)
  if (swErr) return NextResponse.json({ error: swErr.message }, { status: 500 })

  const { error: mErr } = await supabase.from('matchups').insert(matchupsToInsert)
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Activate the league
  await supabase.from('leagues').update({ status: 'active' }).eq('id', leagueId)

  return NextResponse.json({
    weeks_created: scheduleWeeksToInsert.length,
    matchups_created: matchupsToInsert.length,
  })
}
