import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LeagueNav } from '@/components/league/LeagueNav'
import { LiveMatchup } from '@/components/league/LiveMatchup'

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}

export default async function MatchupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const { id: leagueId } = await params
  const { week: weekParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, status, season_year')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id, name, abbreviation')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .single()

  if (!myTeam) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-gray-500">
        <p>You are not a member of this league.</p>
        <Link href="/dashboard" className="text-red-400 hover:text-red-300 mt-2 inline-block">Back to Dashboard</Link>
      </div>
    )
  }

  if (league.status !== 'active') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Matchup</h1>
          <p className="text-gray-400 text-sm mt-1">{league.name}</p>
        </div>
        <LeagueNav leagueId={leagueId} active="matchup" />
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          <p className="text-lg">The season hasn&apos;t started yet.</p>
          <p className="text-sm mt-2">The commissioner needs to generate the schedule and activate the league.</p>
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // Fetch all weeks for this league so we can build navigation
  const { data: allWeekRows } = await supabase
    .from('matchups')
    .select('week, period_start, period_end, status')
    .eq('league_id', leagueId)
    .eq('season_year', league.season_year)
    .order('week')

  // Build week meta, tracking whether ANY matchup in the week is active
  const weekMap = new Map<number, { week: number; period_start: string; period_end: string; anyActive: boolean }>()
  for (const r of allWeekRows ?? []) {
    const ex = weekMap.get(r.week)
    if (!ex) {
      weekMap.set(r.week, { week: r.week, period_start: r.period_start, period_end: r.period_end, anyActive: r.status === 'active' })
    } else {
      weekMap.set(r.week, { ...ex, anyActive: ex.anyActive || r.status === 'active' })
    }
  }
  const weekMeta = Array.from(weekMap.values()).sort((a, b) => a.week - b.week)

  // Determine current week:
  // 1. A week marked active whose period hasn't ended yet
  // 2. The week whose date range contains today
  // 3. The latest week that has already started (handles Monday morning before sync marks new week active)
  // 4. Last week overall as fallback
  const currentWeek =
    weekMeta.find(w => w.anyActive && w.period_end >= today)?.week ??
    weekMeta.find(w => w.period_start <= today && w.period_end >= today)?.week ??
    [...weekMeta].reverse().find(w => w.period_start <= today)?.week ??
    weekMeta[weekMeta.length - 1]?.week ??
    1

  const selectedWeek = weekParam ? parseInt(weekParam) : currentWeek
  const selectedMeta = weekMeta.find(w => w.week === selectedWeek)
  const minWeek = weekMeta[0]?.week ?? 1
  const maxWeek = weekMeta[weekMeta.length - 1]?.week ?? 1

  const dateRange = selectedMeta
    ? `${fmtDate(selectedMeta.period_start)} – ${fmtDate(selectedMeta.period_end)}`
    : null

  // Fetch all matchups for the selected week
  const { data: weekMatchups } = await supabase
    .from('matchups')
    .select(`
      id, week, home_score, away_score, status, period_start, period_end, is_playoff,
      home_team:home_team_id (id, name, abbreviation),
      away_team:away_team_id (id, name, abbreviation)
    `)
    .eq('league_id', leagueId)
    .eq('season_year', league.season_year)
    .eq('week', selectedWeek)

  const myMatchup = (weekMatchups ?? []).find((m: any) =>
    m.home_team.id === myTeam.id || m.away_team.id === myTeam.id
  ) as any

  const otherMatchups = (weekMatchups ?? []).filter((m: any) =>
    m.home_team.id !== myTeam.id && m.away_team.id !== myTeam.id
  ) as any[]

  // Player scores for my matchup
  let myPlayerScores: any[] = []
  let oppPlayerScores: any[] = []

  if (myMatchup) {
    const myIsHome = myMatchup.home_team.id === myTeam.id
    const oppTeamId = myIsHome ? myMatchup.away_team.id : myMatchup.home_team.id

    const { data: scores } = await supabase
      .from('player_game_scores')
      .select('team_id, fantasy_points, players(full_name, primary_position, mlb_team)')
      .eq('matchup_id', myMatchup.id)

    const aggregate = (teamId: string) => {
      const byPlayer: Record<string, { name: string; pos: string; team: string | null; total: number }> = {}
      for (const s of (scores ?? []).filter(s => s.team_id === teamId)) {
        const p = s.players as any
        const key = p.full_name
        if (!byPlayer[key]) byPlayer[key] = { name: p.full_name, pos: p.primary_position, team: p.mlb_team, total: 0 }
        byPlayer[key].total += Number(s.fantasy_points)
      }
      return Object.values(byPlayer).sort((a, b) => b.total - a.total)
    }

    myPlayerScores = aggregate(myTeam.id)
    oppPlayerScores = aggregate(oppTeamId)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Matchup</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name}</p>
      </div>

      <LeagueNav leagueId={leagueId} active="matchup" />

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        {selectedWeek > minWeek ? (
          <Link
            href={`/league/${leagueId}/matchup?week=${selectedWeek - 1}`}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </Link>
        ) : <div />}

        <div className="text-center">
          <p className="text-white font-semibold">Week {selectedWeek}</p>
          {dateRange && <p className="text-xs text-gray-500 mt-0.5">{dateRange}</p>}
        </div>

        {selectedWeek < maxWeek ? (
          <Link
            href={`/league/${leagueId}/matchup?week=${selectedWeek + 1}`}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : <div />}
      </div>

      {/* My matchup */}
      {myMatchup ? (
        <LiveMatchup
          key={myMatchup.id}
          matchupId={myMatchup.id}
          leagueId={leagueId}
          myTeamId={myTeam.id}
          myTeamName={myTeam.name}
          initialHomeScore={Number(myMatchup.home_score)}
          initialAwayScore={Number(myMatchup.away_score)}
          initialStatus={myMatchup.status}
          week={myMatchup.week}
          periodStart={myMatchup.period_start}
          periodEnd={myMatchup.period_end}
          isPlayoff={myMatchup.is_playoff}
          homeTeam={myMatchup.home_team}
          awayTeam={myMatchup.away_team}
          initialMyScores={myPlayerScores}
          initialOppScores={oppPlayerScores}
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          <p>No matchup found for Week {selectedWeek}.</p>
        </div>
      )}

      {/* Rest of league matchups */}
      {otherMatchups.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-sm text-white">Around the League</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {otherMatchups.map((m: any) => {
              const isFinal = m.status === 'final'
              return (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm min-w-0">
                    <Link href={`/league/${leagueId}/team/${m.home_team.id}`} className="text-white hover:text-red-400 transition-colors truncate">
                      {m.home_team.name}
                    </Link>
                    <span className="text-gray-600 flex-shrink-0">vs</span>
                    <Link href={`/league/${leagueId}/team/${m.away_team.id}`} className="text-white hover:text-red-400 transition-colors truncate">
                      {m.away_team.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <span className="text-sm font-mono text-gray-300 tabular-nums">
                      {Number(m.home_score).toFixed(1)}
                      <span className="text-gray-600 mx-1">–</span>
                      {Number(m.away_score).toFixed(1)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      isFinal ? 'bg-gray-700 text-gray-400' :
                      m.status === 'active' ? 'bg-green-900 text-green-400' :
                      'bg-gray-800 text-gray-500'
                    }`}>
                      {isFinal ? 'F' : m.status === 'active' ? '●' : '–'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
