import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { RosterGrid } from '@/components/league/RosterGrid'
import { LeagueNav } from '@/components/league/LeagueNav'
import { AutoRefresh } from '@/components/AutoRefresh'
import { TeamNameEditor } from '@/components/league/TeamNameEditor'

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id: leagueId } = await params
  const { date: dateParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get league + settings
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, status, season_year, is_contract_league, has_taxi_squad, commissioner_id, co_commissioner_id, league_settings(*)')
    .eq('id', leagueId)
    .single()

  if (!league) notFound()

  // Find my team in this league
  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id, name, abbreviation, faab_remaining, wins, losses, ties, points_for')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .single()

  if (!myTeam) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-gray-500">
        <p>You are not a member of this league.</p>
        <Link href="/dashboard" className="text-red-400 hover:text-red-300 mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  // Fetch my roster with player info
  const { data: rosterRows } = await supabase
    .from('rosters')
    .select(`
      id, slot_type, acquisition_type, acquired_at,
      players (id, mlb_id, full_name, primary_position, mlb_team, status, is_rookie, is_second_year)
    `)
    .eq('team_id', myTeam.id)
    .order('slot_type')

  // Fetch active contract info if contract league
  let contracts: Record<string, { id: string; salary: number; years_total: number; years_remaining: number; expires_after_season: number; contract_type: string }> = {}
  if (league.is_contract_league && rosterRows && rosterRows.length > 0) {
    const playerIds = rosterRows.map(r => (r.players as any).id)
    const { data: contractData } = await supabase
      .from('contracts')
      .select('id, player_id, salary, years_total, years_remaining, expires_after_season, contract_type')
      .in('player_id', playerIds)
      .eq('league_id', leagueId)
      .is('voided_at', null)

    for (const c of contractData ?? []) {
      contracts[c.player_id] = {
        id: c.id,
        salary: c.salary,
        years_total: c.years_total,
        years_remaining: c.years_remaining,
        expires_after_season: c.expires_after_season,
        contract_type: c.contract_type,
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]
  // selectedDate: the date to show "day" stats for (defaults to today)
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today

  // Find the matchup that covers the selected date
  const { data: currentMatchup } = await supabase
    .from('matchups')
    .select('id, period_start, period_end')
    .or(`home_team_id.eq.${myTeam.id},away_team_id.eq.${myTeam.id}`)
    .lte('period_start', selectedDate)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  type ScoreEntry = { fantasy_points: number; batting: any; pitching: any }
  const weekScores: Record<string, ScoreEntry> = {}
  const todayScores: Record<string, ScoreEntry> = {}

  if (currentMatchup) {
    const { data: gameScores } = await supabase
      .from('player_game_scores')
      .select('player_id, fantasy_points, raw_stats, mlb_game_id, game_date')
      .eq('team_id', myTeam.id)
      .eq('matchup_id', currentMatchup.id)

    for (const gs of gameScores ?? []) {
      const isPitching = (gs.mlb_game_id as number) < 0

      // Weekly total (all scores in this matchup)
      if (!weekScores[gs.player_id]) weekScores[gs.player_id] = { fantasy_points: 0, batting: null, pitching: null }
      weekScores[gs.player_id].fantasy_points += Number(gs.fantasy_points)
      if (isPitching) weekScores[gs.player_id].pitching = gs.raw_stats
      else            weekScores[gs.player_id].batting  = gs.raw_stats

      // Selected date stats
      if (gs.game_date === selectedDate) {
        if (!todayScores[gs.player_id]) todayScores[gs.player_id] = { fantasy_points: 0, batting: null, pitching: null }
        todayScores[gs.player_id].fantasy_points += Number(gs.fantasy_points)
        if (isPitching) todayScores[gs.player_id].pitching = gs.raw_stats
        else            todayScores[gs.player_id].batting  = gs.raw_stats
      }
    }
  }

  const players = (rosterRows ?? []).map(r => {
    const p = r.players as any
    return {
      roster_id: r.id,
      player_id: p.id,
      mlb_id: p.mlb_id,
      full_name: p.full_name,
      primary_position: p.primary_position,
      mlb_team: p.mlb_team,
      status: p.status,
      slot_type: r.slot_type,
      is_rookie: p.is_rookie,
      is_second_year: p.is_second_year ?? false,
      contract: contracts[p.id] ?? null,
    }
  })

  const settings = (league.league_settings as any) ?? {}

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AutoRefresh intervalSeconds={120} />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {myTeam.name}
            <TeamNameEditor leagueId={leagueId} teamId={myTeam.id} initialName={myTeam.name} initialAbbreviation={myTeam.abbreviation} />
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {league.name} · {myTeam.wins}–{myTeam.losses} · {myTeam.points_for.toFixed(1)} pts
            {settings.waiver_type === 'faab' && myTeam.faab_remaining != null && (
              <span className="ml-2 text-green-400">${myTeam.faab_remaining} FAAB</span>
            )}
          </p>
        </div>
        <Link
          href={`/league/${leagueId}/waivers`}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors text-white"
        >
          Add Player
        </Link>
      </div>

      <LeagueNav
        leagueId={leagueId}
        active="roster"
        isCommissioner={league.commissioner_id === user.id || league.co_commissioner_id === user.id}
      />

      <RosterGrid
        players={players}
        leagueId={leagueId}
        settings={{
          spots_c:    settings.spots_c    ?? 1,
          spots_1b:   settings.spots_1b   ?? 1,
          spots_2b:   settings.spots_2b   ?? 1,
          spots_3b:   settings.spots_3b   ?? 1,
          spots_ss:   settings.spots_ss   ?? 1,
          spots_of:   settings.spots_of   ?? 3,
          spots_if:   settings.spots_if   ?? 0,
          spots_util: settings.spots_util ?? 1,
          spots_sp:   settings.spots_sp   ?? 2,
          spots_rp:   settings.spots_rp   ?? 2,
          spots_p:    settings.spots_p    ?? 0,
          spots_bench: settings.spots_bench ?? 4,
          spots_il:   settings.spots_il   ?? 2,
          has_taxi_squad: !!(league as any).has_taxi_squad,
        }}
        teamId={myTeam.id}
        isContractLeague={!!league.is_contract_league}
        contracts={contracts}
        weekScores={weekScores}
        todayScores={todayScores}
        seasonYear={league.season_year ?? new Date().getFullYear()}
        selectedDate={selectedDate}
        matchupPeriod={currentMatchup ? { start: currentMatchup.period_start, end: currentMatchup.period_end } : null}
      />
    </div>
  )
}

