import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import React from 'react'
import Link from 'next/link'
import { LeagueNav } from '@/components/league/LeagueNav'

export default async function StandingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, status, season_year, playoff_start_week, regular_season_weeks')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .maybeSingle()

  // Get all teams with their records
  const { data: teams } = await supabase
    .from('fantasy_teams')
    .select('id, name, abbreviation, wins, losses, ties, points_for, points_against, profiles(display_name)')
    .eq('league_id', leagueId)

  if (!teams) notFound()

  // Sort: most wins → least losses → most points
  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (a.losses !== b.losses) return a.losses - b.losses
    return Number(b.points_for) - Number(a.points_for)
  })

  // Get last 5 matchup results per team
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const { data: recentMatchups } = await supabase
    .from('matchups')
    .select('home_team_id, away_team_id, home_score, away_score, status')
    .eq('league_id', leagueId)
    .eq('season_year', league.season_year)
    .eq('status', 'final')
    .order('week', { ascending: false })
    .limit(league.regular_season_weeks * (teams.length / 2))

  // Build last-5 streaks per team
  const last5: Record<string, ('W' | 'L' | 'T')[]> = {}
  for (const team of teams) {
    last5[team.id] = []
  }
  for (const m of recentMatchups ?? []) {
    const homeWin = Number(m.home_score) > Number(m.away_score)
    const awayWin = Number(m.away_score) > Number(m.home_score)
    const tie = Number(m.home_score) === Number(m.away_score)

    const pushIfRoom = (teamId: string, result: 'W' | 'L' | 'T') => {
      if ((last5[teamId]?.length ?? 0) < 5) last5[teamId]?.push(result)
    }
    pushIfRoom(m.home_team_id, homeWin ? 'W' : tie ? 'T' : 'L')
    pushIfRoom(m.away_team_id, awayWin ? 'W' : tie ? 'T' : 'L')
  }

  const resultColor = (r: 'W' | 'L' | 'T') =>
    r === 'W' ? 'text-green-400' : r === 'L' ? 'text-red-400' : 'text-gray-400'

  const playoffCutline = league.playoff_start_week
    ? Math.ceil(teams.length / 3)  // rough estimate: top third make playoffs
    : 4

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Standings</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name} · {league.season_year}</p>
      </div>

      <LeagueNav leagueId={leagueId} active="standings" />

      {league.status === 'setup' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          <p>The season hasn&apos;t started yet. Standings will appear once the schedule is generated.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-white">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
                <th className="text-left px-5 py-3 w-8">#</th>
                <th className="text-left px-5 py-3">Team</th>
                <th className="text-right px-4 py-3">W</th>
                <th className="text-right px-4 py-3">L</th>
                <th className="text-right px-4 py-3">T</th>
                <th className="text-right px-4 py-3">PF</th>
                <th className="text-right px-4 py-3">PA</th>
                <th className="text-right px-5 py-3">L5</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((team, i) => {
                const isMine = myTeam?.id === team.id
                const isPlayoffLine = i === playoffCutline - 1 && league.status === 'active'
                return (
                  <React.Fragment key={team.id}>
                    <tr
                      className={`border-b border-gray-800 last:border-0 ${isMine ? 'bg-red-950/30' : ''}`}
                    >
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{i + 1}</td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/league/${leagueId}/team/${team.id}`}
                          className={`font-semibold hover:text-red-400 transition-colors ${isMine ? 'text-red-300' : 'text-white'}`}
                        >
                          {team.name}
                        </Link>
                        {isMine && <span className="ml-2 text-xs text-red-400">(you)</span>}
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(team.profiles as any)?.display_name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-bold">{team.wins}</td>
                      <td className="px-4 py-3 text-right text-red-400">{team.losses}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{team.ties}</td>
                      <td className="px-4 py-3 text-right text-gray-200 font-mono">{Number(team.points_for).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-gray-500 font-mono">{Number(team.points_against).toFixed(1)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono text-xs tracking-wider">
                          {(last5[team.id] ?? []).map((r, ri) => (
                            <span key={ri} className={`${resultColor(r)} ml-0.5`}>{r}</span>
                          ))}
                          {(last5[team.id] ?? []).length === 0 && <span className="text-gray-600">—</span>}
                        </span>
                      </td>
                    </tr>
                    {isPlayoffLine && (
                      <tr className="h-px">
                        <td colSpan={8} className="bg-red-600/40 h-px p-0">
                          <div className="text-right pr-5 text-xs text-red-400 pb-1">— playoff line —</div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
