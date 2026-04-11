import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LeagueNav } from '@/components/league/LeagueNav'
import { LiveMatchup } from '@/components/league/LiveMatchup'

export default async function MatchupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = await params
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

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // Find current matchup for my team
  const { data: currentMatchup } = await supabase
    .from('matchups')
    .select(`
      id, week, home_score, away_score, status, period_start, period_end, is_playoff,
      home_team:home_team_id (id, name, abbreviation),
      away_team:away_team_id (id, name, abbreviation)
    `)
    .eq('league_id', leagueId)
    .eq('season_year', league.season_year)
    .lte('period_start', today)
    .gte('period_end', today)
    .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
    .single()

  // Get player game scores for this matchup
  let myPlayerScores: any[] = []
  let oppPlayerScores: any[] = []
  let oppTeamId = ''

  if (currentMatchup) {
    const m = currentMatchup as any
    const myIsHome = m.home_team.id === myTeam.id
    oppTeamId = myIsHome ? m.away_team.id : m.home_team.id

    const { data: scores } = await supabase
      .from('player_game_scores')
      .select('team_id, fantasy_points, players(full_name, primary_position, mlb_team)')
      .eq('matchup_id', currentMatchup.id)

    const aggregate = (teamId: string) => {
      const teamScores = (scores ?? []).filter(s => s.team_id === teamId)
      const byPlayer: Record<string, { name: string; pos: string; team: string | null; total: number }> = {}
      for (const s of teamScores) {
        const p = s.players as any
        const key = teamId + p.full_name
        if (!byPlayer[key]) byPlayer[key] = { name: p.full_name, pos: p.primary_position, team: p.mlb_team, total: 0 }
        byPlayer[key].total += Number(s.fantasy_points)
      }
      return Object.values(byPlayer).sort((a, b) => b.total - a.total)
    }

    myPlayerScores = aggregate(myTeam.id)
    oppPlayerScores = aggregate(oppTeamId)
  }

  // Recent matchups (last 5)
  const { data: recentMatchups } = await supabase
    .from('matchups')
    .select(`
      id, week, home_score, away_score, status,
      home_team:home_team_id (id, name, abbreviation),
      away_team:away_team_id (id, name, abbreviation)
    `)
    .eq('league_id', leagueId)
    .eq('season_year', league.season_year)
    .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
    .order('week', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Matchup</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name}</p>
      </div>

      <LeagueNav leagueId={leagueId} active="matchup" />

      {league.status !== 'active' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          <p className="text-lg">The season hasn&apos;t started yet.</p>
          <p className="text-sm mt-2">The commissioner needs to generate the schedule and activate the league.</p>
        </div>
      ) : !currentMatchup ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          <p className="text-lg">No active matchup this week.</p>
        </div>
      ) : (
        <LiveMatchup
          matchupId={currentMatchup.id}
          leagueId={leagueId}
          myTeamId={myTeam.id}
          myTeamName={myTeam.name}
          initialHomeScore={Number((currentMatchup as any).home_score)}
          initialAwayScore={Number((currentMatchup as any).away_score)}
          initialStatus={(currentMatchup as any).status}
          week={(currentMatchup as any).week}
          periodStart={(currentMatchup as any).period_start}
          periodEnd={(currentMatchup as any).period_end}
          isPlayoff={(currentMatchup as any).is_playoff}
          homeTeam={(currentMatchup as any).home_team}
          awayTeam={(currentMatchup as any).away_team}
          initialMyScores={myPlayerScores}
          initialOppScores={oppPlayerScores}
        />
      )}

      {/* Recent matchup history */}
      {recentMatchups && recentMatchups.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="font-semibold text-sm text-white">Recent Matchups</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {recentMatchups.map((m: any) => {
              const myIsHome = m.home_team.id === myTeam.id
              const myScore = myIsHome ? m.home_score : m.away_score
              const oppScore = myIsHome ? m.away_score : m.home_score
              const opp = myIsHome ? m.away_team : m.home_team
              const won = myScore > oppScore
              return (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-gray-400">Week {m.week}</span>
                    <span className="mx-2 text-gray-600">vs</span>
                    <Link href={`/league/${leagueId}/team/${opp.id}`} className="text-white hover:text-red-400 transition-colors">{opp.name}</Link>
                  </div>
                  <div className="text-sm font-mono">
                    <span className={won ? 'text-green-400 font-bold' : 'text-gray-400'}>
                      {Number(myScore).toFixed(1)}
                    </span>
                    <span className="text-gray-600 mx-1">–</span>
                    <span className={!won ? 'text-green-400 font-bold' : 'text-gray-400'}>
                      {Number(oppScore).toFixed(1)}
                    </span>
                    {m.status === 'final' && (
                      <span className={`ml-2 text-xs font-semibold ${won ? 'text-green-400' : 'text-red-400'}`}>
                        {won ? 'W' : 'L'}
                      </span>
                    )}
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
