import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeagueNav } from '@/components/league/LeagueNav'
import { CommissionerRosterManager } from '@/components/league/CommissionerRosterManager'
import { TeamNameEditor } from '@/components/league/TeamNameEditor'
import { PositionsSyncButton } from '@/components/league/PositionsSyncButton'

export default async function CommissionerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, commissioner_id, co_commissioner_id, is_contract_league, has_taxi_squad, league_settings(*)')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const isCommish = league.commissioner_id === user.id || league.co_commissioner_id === user.id
  if (!isCommish) redirect(`/league/${leagueId}`)

  const settings = (league.league_settings as any) ?? {}

  // Fetch all teams
  const { data: teams } = await supabase
    .from('fantasy_teams')
    .select('id, name, abbreviation, owner_id')
    .eq('league_id', leagueId)
    .order('name')

  if (!teams || teams.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <LeagueNav leagueId={leagueId} active="commissioner" isCommissioner={true} />
        <p className="text-gray-500">No teams in this league yet.</p>
      </div>
    )
  }

  const teamIds = teams.map(t => t.id)

  // Fetch all rosters for all teams
  const { data: rosters } = await supabase
    .from('rosters')
    .select('id, team_id, slot_type, player_id, players(id, mlb_id, full_name, primary_position, mlb_team, status, is_rookie, is_second_year)')
    .in('team_id', teamIds)
    .order('slot_type')

  // Group by team
  const rosterByTeam: Record<string, any[]> = {}
  for (const r of rosters ?? []) {
    if (!rosterByTeam[r.team_id]) rosterByTeam[r.team_id] = []
    rosterByTeam[r.team_id].push(r)
  }

  // All rostered player IDs (for free agent filtering)
  const rosteredIds = (rosters ?? []).map(r => r.player_id)

  const fullSettings = {
    spots_c:     settings.spots_c     ?? 1,
    spots_1b:    settings.spots_1b    ?? 1,
    spots_2b:    settings.spots_2b    ?? 1,
    spots_3b:    settings.spots_3b    ?? 1,
    spots_ss:    settings.spots_ss    ?? 1,
    spots_of:    settings.spots_of    ?? 3,
    spots_if:    settings.spots_if    ?? 0,
    spots_util:  settings.spots_util  ?? 1,
    spots_sp:    settings.spots_sp    ?? 2,
    spots_rp:    settings.spots_rp    ?? 2,
    spots_p:     settings.spots_p     ?? 0,
    spots_bench: settings.spots_bench ?? 4,
    spots_il:    settings.spots_il    ?? 2,
    has_taxi_squad: !!(league as any).has_taxi_squad,
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Manage Rosters</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name} — Commissioner Tools</p>
      </div>

      <LeagueNav leagueId={leagueId} active="commissioner" isCommissioner={true} />

      {/* Team Name Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Team Names</h2>
        <div className="space-y-2">
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 w-12">{team.abbreviation}</span>
              <span className="text-sm text-white">{team.name}</span>
              <TeamNameEditor
                leagueId={leagueId}
                teamId={team.id}
                initialName={team.name}
                initialAbbreviation={team.abbreviation}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Position eligibility sync */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Position Eligibility</h2>
        <p className="text-xs text-gray-500 mb-3">
          Fetches positions played this season and last from the MLB API and updates each player&apos;s eligible roster slots.
          Run this once at the start of the season and again if you notice a player missing a position.
        </p>
        <PositionsSyncButton />
      </div>

      <CommissionerRosterManager
        leagueId={leagueId}
        teams={teams}
        rosterByTeam={rosterByTeam}
        rosteredIds={rosteredIds}
        settings={fullSettings}
        isContractLeague={!!league.is_contract_league}
      />
    </div>
  )
}
