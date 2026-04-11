import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { LeagueNav } from '@/components/league/LeagueNav'
import { WaiverBoard } from '@/components/league/WaiverBoard'

export default async function WaiversPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; pos?: string; starting?: string }>
}) {
  const { id: leagueId } = await params
  const { q, pos, starting } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, status, is_contract_league, commissioner_id, league_settings(waiver_type, faab_budget)')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id, name, faab_remaining, waiver_priority')
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

  const isCommissioner = league.commissioner_id === user.id
  const settings = (league.league_settings as any) ?? {}
  const waiverType = settings.waiver_type ?? 'standard'
  const isFaab = waiverType === 'faab'
  const isOpenFa = waiverType === 'none'

  // Get all rostered player IDs in this league
  const { data: allTeams } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)

  const teamIds = allTeams?.map(t => t.id) ?? []

  let rosteredIds: string[] = []
  if (teamIds.length > 0) {
    const { data: rosters } = await supabase
      .from('rosters')
      .select('player_id')
      .in('team_id', teamIds)
    rosteredIds = rosters?.map(r => r.player_id) ?? []
  }

  // Fetch probable starters (today + tomorrow) for filter
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  const { data: probableStarts } = await admin
    .from('pitcher_probable_starts')
    .select('player_id, game_date, opponent, home_away')
    .gte('game_date', today)
    .lte('game_date', tomorrow)

  // Build map: player_id → starts[]
  const startsMap = new Map<string, { game_date: string; opponent: string | null; home_away: string | null }[]>()
  for (const s of probableStarts ?? []) {
    if (!s.player_id) continue
    if (!startsMap.has(s.player_id)) startsMap.set(s.player_id, [])
    startsMap.get(s.player_id)!.push({ game_date: s.game_date, opponent: s.opponent, home_away: s.home_away })
  }

  const startingTodayIds = new Set<string>()
  const startingTomorrowIds = new Set<string>()
  for (const [pid, starts] of startsMap) {
    for (const s of starts) {
      if (s.game_date === today) startingTodayIds.add(pid)
      if (s.game_date === tomorrow) startingTomorrowIds.add(pid)
    }
  }

  // Determine which player IDs to filter to for "starting" filter
  let startingFilterIds: string[] | null = null
  if (starting === 'today') startingFilterIds = [...startingTodayIds]
  if (starting === 'tomorrow') startingFilterIds = [...startingTomorrowIds]
  if (starting === 'any') startingFilterIds = [...new Set([...startingTodayIds, ...startingTomorrowIds])]

  // Search free agents
  let faQuery = supabase
    .from('players')
    .select('id, full_name, primary_position, mlb_team, status, is_rookie')
    .order('full_name')
    .limit(2000)

  if (rosteredIds.length > 0) faQuery = faQuery.not('id', 'in', `(${rosteredIds.join(',')})`)
  if (q) faQuery = faQuery.ilike('full_name', `%${q}%`)
  if (pos) faQuery = faQuery.eq('primary_position', pos)
  if (startingFilterIds !== null) {
    if (startingFilterIds.length === 0) {
      // No pitchers starting — return empty
      faQuery = faQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    } else {
      faQuery = faQuery.in('id', startingFilterIds)
    }
  }

  const { data: freeAgentsRaw } = await faQuery

  // Sort: active before minors, then by position scarcity, then name
  const POSITION_RANK: Record<string, number> = {
    SP: 0, C: 1, SS: 2, '2B': 3, '3B': 4, RP: 5, '1B': 6, OF: 7, DH: 8,
  }
  const STATUS_RANK: Record<string, number> = { active: 0, minors: 1 }
  const freeAgents = (freeAgentsRaw ?? []).sort((a, b) => {
    const statusDiff = (STATUS_RANK[a.status] ?? 2) - (STATUS_RANK[b.status] ?? 2)
    if (statusDiff !== 0) return statusDiff
    const posDiff = (POSITION_RANK[a.primary_position] ?? 9) - (POSITION_RANK[b.primary_position] ?? 9)
    if (posDiff !== 0) return posDiff
    return a.full_name.localeCompare(b.full_name)
  }).slice(0, q ? 200 : 100)

  // Attach probable start info to free agents
  const freeAgentsWithStarts = (freeAgents ?? []).map(p => ({
    ...p,
    probable_starts: startsMap.get(p.id) ?? [],
  }))

  // My roster for "drop" selection
  const { data: myRoster } = await supabase
    .from('rosters')
    .select('player_id, slot_type, players(full_name, primary_position)')
    .eq('team_id', myTeam.id)

  // My pending claims
  const { data: myClaims } = await supabase
    .from('waiver_claims')
    .select('id, player_add_id, player_drop_id, bid_amount, status, process_date, players:player_add_id(full_name, primary_position)')
    .eq('league_id', leagueId)
    .eq('team_id', myTeam.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const positions = ['C','1B','2B','3B','SS','OF','SP','RP','DH']

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Waivers / Free Agents</h1>
          <p className="text-gray-400 text-sm mt-1">
            {league.name}
            {isFaab && (
              <span className="ml-3 text-green-400 font-medium">${myTeam.faab_remaining} FAAB remaining</span>
            )}
            {isOpenFa && (
              <span className="ml-3 text-blue-400 font-medium">Open Free Agency — pick up anyone instantly</span>
            )}
          </p>
        </div>
      </div>

      <LeagueNav leagueId={leagueId} active="waivers" isCommissioner={isCommissioner} />

      {/* Search / filter bar */}
      <form className="flex flex-wrap gap-3" method="GET">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name..."
          autoComplete="off"
          className="input max-w-xs"
        />
        <select name="pos" defaultValue={pos ?? ''} className="input w-32">
          <option value="">All Pos</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="starting" defaultValue={starting ?? ''} className="input w-44">
          <option value="">All Pitchers</option>
          <option value="today">Starting Today</option>
          <option value="tomorrow">Starting Tomorrow</option>
          <option value="any">Starting Today or Tomorrow</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors text-white">
          Filter
        </button>
      </form>

      <WaiverBoard
        leagueId={leagueId}
        myTeamId={myTeam.id}
        freeAgents={freeAgentsWithStarts}
        myRoster={(myRoster ?? []).map(r => ({ player_id: r.player_id, slot_type: r.slot_type, player: r.players as any }))}
        myClaims={(myClaims ?? []).map(c => ({ ...c, player: c.players as any }))}
        isFaab={isFaab}
        isOpenFa={isOpenFa}
        faabRemaining={myTeam.faab_remaining}
        isCommissioner={isCommissioner}
      />
    </div>
  )
}
