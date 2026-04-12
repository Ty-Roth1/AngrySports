import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LeagueNav } from '@/components/league/LeagueNav'

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select(`
      *,
      league_settings (*),
      fantasy_teams (
        id, name, abbreviation, owner_id, wins, losses, ties, points_for,
        profiles (display_name)
      )
    `)
    .eq('id', id)
    .single()

  if (!league) notFound()

  const isCommissioner = league.commissioner_id === user.id
  const myTeam = league.fantasy_teams.find((t: any) => t.owner_id === user.id)

  // Payroll per team (contract leagues only)
  const payrollByTeam: Record<string, number> = {}
  if (league.is_contract_league) {
    const teamIds = league.fantasy_teams.map((t: any) => t.id)
    const [rostersRes, contractsRes] = await Promise.all([
      supabase
        .from('rosters')
        .select('team_id, player_id')
        .in('team_id', teamIds),
      supabase
        .from('contracts')
        .select('player_id, salary')
        .eq('league_id', id)
        .is('voided_at', null),
    ])
    const salaryByPlayer: Record<string, number> = {}
    for (const c of contractsRes.data ?? []) {
      salaryByPlayer[c.player_id] = Number(c.salary)
    }
    for (const r of rostersRes.data ?? []) {
      const sal = salaryByPlayer[r.player_id] ?? 0
      payrollByTeam[r.team_id] = (payrollByTeam[r.team_id] ?? 0) + sal
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{league.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {league.season_year} Season &middot; {league.fantasy_teams.length}/{league.max_teams} teams &middot; {league.scoring_type === 'head_to_head_points' ? 'H2H Points' : 'Rotisserie'}
          </p>
        </div>
        <div className="flex gap-2">
          {isCommissioner && (
            <Link href={`/league/${id}/settings`}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
              Commissioner Tools
            </Link>
          )}
          {league.status === 'setup' && isCommissioner && (
            <Link href={`/league/${id}/invite`}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors">
              Invite Teams
            </Link>
          )}
        </div>
      </div>

      <LeagueNav leagueId={id} active="overview" />

      {/* Status banner */}
      {league.status === 'setup' && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-300 text-sm font-medium">
            League setup in progress — {league.fantasy_teams.length}/{league.max_teams} teams joined.
            {isCommissioner && league.fantasy_teams.length < 2 && ' Invite managers to get started.'}
          </p>
        </div>
      )}

      {/* Quick stats for my team */}
      {myTeam && league.status === 'active' && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Record', value: `${myTeam.wins}-${myTeam.losses}${myTeam.ties > 0 ? `-${myTeam.ties}` : ''}` },
            { label: 'Points For', value: myTeam.points_for.toFixed(1) },
            { label: 'Rank', value: `#${league.fantasy_teams
                .slice()
                .sort((a: any, b: any) => b.wins - a.wins || b.points_for - a.points_for)
                .findIndex((t: any) => t.id === myTeam.id) + 1}` },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Teams list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold">Teams</h2>
          <span className="text-sm text-gray-400">{league.fantasy_teams.length} / {league.max_teams}</span>
        </div>
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-5 py-2.5">Team</th>
              <th className="text-left px-5 py-2.5">Manager</th>
              <th className="text-right px-5 py-2.5">W</th>
              <th className="text-right px-5 py-2.5">L</th>
              <th className="text-right px-5 py-2.5">PF</th>
              {league.is_contract_league && (
                <th className="text-right px-5 py-2.5">Payroll</th>
              )}
            </tr>
          </thead>
          <tbody>
            {league.fantasy_teams
              .slice()
              .sort((a: any, b: any) => b.wins - a.wins || b.points_for - a.points_for)
              .map((team: any) => (
                <tr key={team.id}
                  className={`border-b border-gray-800 last:border-0 ${team.id === myTeam?.id ? 'bg-gray-800/40' : ''}`}>
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/league/${id}/team/${team.id}`}
                      className="text-white hover:text-red-400 transition-colors"
                    >
                      {team.name}
                    </Link>
                    {team.id === myTeam?.id && <span className="ml-2 text-xs text-red-400">(you)</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{team.profiles?.display_name}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{team.wins}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{team.losses}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{team.points_for.toFixed(1)}</td>
                  {league.is_contract_league && (
                    <td className="px-5 py-3 text-right text-gray-300">
                      ${(payrollByTeam[team.id] ?? 0).toLocaleString()}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* League details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-gray-300">League Features</h3>
          <ul className="space-y-1.5 text-gray-400">
            <li>{league.is_contract_league ? '✓ Contract League' : '✗ No Contracts'}</li>
            <li>{league.is_keeper_league ? `✓ Keeper League (${league.max_keepers_per_team} max)` : '✗ No Keepers'}</li>
            <li>{league.has_taxi_squad ? `✓ Taxi Squad (${league.taxi_squad_size} spots)` : '✗ No Taxi Squad'}</li>
          </ul>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-3 text-gray-300">Season Info</h3>
          <ul className="space-y-1.5 text-gray-400">
            <li>Regular season: {league.regular_season_weeks} weeks</li>
            <li>Playoffs: {league.playoff_teams} teams</li>
            <li>Playoff start: Week {league.playoff_start_week}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
