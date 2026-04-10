import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LeagueNav } from '@/components/league/LeagueNav'
import { TradeCenter } from '@/components/league/TradeCenter'

export default async function TradesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, status, season_year, commissioner_id, co_commissioner_id, league_settings(cash_trade_limit, trade_deadline_week, trade_review_period)')
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

  const isCommissioner = league.commissioner_id === user.id || (league as any).co_commissioner_id === user.id
  const settings = (league.league_settings as any) ?? {}
  const cashLimit = settings.cash_trade_limit ?? 30

  // All teams (trade partners)
  const { data: allTeams } = await supabase
    .from('fantasy_teams')
    .select('id, name, abbreviation')
    .eq('league_id', leagueId)
    .neq('id', myTeam.id)
    .order('name')

  // My roster
  const { data: myRosterRaw } = await supabase
    .from('rosters')
    .select('player_id, slot_type, players(id, full_name, primary_position, mlb_team, status)')
    .eq('team_id', myTeam.id)
    .not('slot_type', 'in', '(IL,TAXI)')

  const myRoster = (myRosterRaw ?? []).map(r => ({
    player_id: r.player_id,
    slot_type: r.slot_type,
    ...(r.players as any),
  }))

  // My draft picks
  const { data: myPicksRaw } = await supabase
    .from('draft_picks')
    .select('id, season_year, round, original_team:original_team_id(id, name, abbreviation)')
    .eq('current_team_id', myTeam.id)
    .eq('league_id', leagueId)
    .eq('used', false)
    .order('season_year')
    .order('round')

  const myPicks = (myPicksRaw ?? []).map(p => ({
    ...p,
    original_team: p.original_team as any,
  }))

  // Cash already sent this season
  const { data: completedIds } = await supabase
    .from('trades')
    .select('id')
    .eq('league_id', leagueId)
    .eq('status', 'completed')
    .or(`proposing_team_id.eq.${myTeam.id},receiving_team_id.eq.${myTeam.id}`)

  let cashSentThisSeason = 0
  if (completedIds && completedIds.length > 0) {
    const { data: cashItems } = await supabase
      .from('trade_items')
      .select('cash_amount')
      .in('trade_id', completedIds.map(t => t.id))
      .eq('from_team_id', myTeam.id)
      .eq('item_type', 'cash')
    cashSentThisSeason = (cashItems ?? []).reduce((s, i) => s + (Number(i.cash_amount) || 0), 0)
  }

  // All trades in the league
  const { data: tradesRaw } = await supabase
    .from('trades')
    .select(`
      id, status, notes, proposed_at, responded_at, executed_at, counter_of,
      proposing_team:proposing_team_id (id, name, abbreviation),
      receiving_team:receiving_team_id (id, name, abbreviation),
      trade_items (
        id, item_type, cash_amount,
        from_team:from_team_id (id, name),
        to_team:to_team_id (id, name),
        player:player_id (id, full_name, primary_position, mlb_team),
        draft_pick:draft_pick_id (
          id, season_year, round,
          original_team:original_team_id (id, name, abbreviation)
        )
      )
    `)
    .eq('league_id', leagueId)
    .order('proposed_at', { ascending: false })
    .limit(50)

  const trades = (tradesRaw ?? []) as any[]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trade Center</h1>
        <p className="text-gray-400 text-sm mt-1">
          {league.name}
          <span className="ml-3 text-gray-500">·</span>
          <span className="ml-3 text-gray-400">
            Cash budget: <span className="text-white">${cashSentThisSeason.toFixed(0)} / ${cashLimit} sent this season</span>
          </span>
        </p>
      </div>

      <LeagueNav leagueId={leagueId} active="trades" />

      <TradeCenter
        leagueId={leagueId}
        myTeam={myTeam}
        allTeams={allTeams ?? []}
        myRoster={myRoster}
        myPicks={myPicks}
        cashSentThisSeason={cashSentThisSeason}
        cashLimit={cashLimit}
        trades={trades}
        isCommissioner={isCommissioner}
        currentUserId={user.id}
      />
    </div>
  )
}
