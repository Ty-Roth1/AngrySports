import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ScoringEditor } from '@/components/league/ScoringEditor'
import { ScheduleGenerator } from '@/components/league/ScheduleGenerator'
import { LeagueNav } from '@/components/league/LeagueNav'
import { TeamCreator } from '@/components/league/TeamCreator'
import { CommissionerTools } from '@/components/league/CommissionerTools'
import { NicknameManager } from '@/components/league/NicknameManager'
import { DraftPickGenerator } from '@/components/league/DraftPickGenerator'

export default async function LeagueSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('*, league_settings(*), scoring_categories(*)')
    .eq('id', id)
    .single()

  if (!league) notFound()
  if (league.commissioner_id !== user.id) redirect(`/league/${id}`)

  const categories = (league.scoring_categories ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const settings = (league.league_settings as any) ?? {}

  // Get co-commissioner info
  let coCommishName: string | null = null
  if (league.co_commissioner_id) {
    const { data: coProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', league.co_commissioner_id)
      .single()
    coCommishName = coProfile?.display_name ?? null
  }

  // Get all rostered players with their nicknames for this league
  const { data: allTeams } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', id)
  const teamIds = (allTeams ?? []).map(t => t.id)

  let rosteredPlayers: any[] = []
  if (teamIds.length > 0) {
    const { data: rosters } = await supabase
      .from('rosters')
      .select('player_id, players(id, full_name, primary_position, mlb_team)')
      .in('team_id', teamIds)
    rosteredPlayers = (rosters ?? []).map(r => r.players).filter(Boolean)
  }

  // Deduplicate
  const playerMap = new Map<string, any>()
  for (const p of rosteredPlayers) {
    if (p && !playerMap.has(p.id)) playerMap.set(p.id, p)
  }

  // Get existing nicknames
  const { data: nicknames } = await supabase
    .from('player_nicknames')
    .select('player_id, nickname')
    .eq('league_id', id)

  const nicknameMap = new Map<string, string>()
  for (const n of nicknames ?? []) {
    nicknameMap.set(n.player_id, n.nickname)
  }

  const playersWithNicknames = [...playerMap.values()].map(p => ({
    ...p,
    current_nickname: nicknameMap.get(p.id) ?? undefined,
  })).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Commissioner Settings</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name}</p>
      </div>

      <LeagueNav leagueId={id} active="settings" isCommissioner={true} />

      {/* Commissioner Tools: League Settings + Co-Commissioner */}
      <section>
        <h2 className="text-lg font-semibold mb-1 text-white">League Configuration</h2>
        <p className="text-sm text-gray-400 mb-4">
          Edit league name, waiver settings, trade deadline, and assign a co-commissioner.
        </p>
        <CommissionerTools
          leagueId={id}
          currentCoCommish={coCommishName}
          leagueName={league.name}
          currentWaiverType={settings.waiver_type ?? 'faab'}
          currentFaabBudget={settings.faab_budget ?? 500}
          currentTradeDeadlineWeek={settings.trade_deadline_week ?? 20}
          currentRosterSpots={{
            spots_c:     settings.spots_c     ?? 1,
            spots_1b:    settings.spots_1b    ?? 1,
            spots_2b:    settings.spots_2b    ?? 1,
            spots_3b:    settings.spots_3b    ?? 1,
            spots_ss:    settings.spots_ss    ?? 1,
            spots_if:    settings.spots_if    ?? 0,
            spots_of:    settings.spots_of    ?? 3,
            spots_util:  settings.spots_util  ?? 1,
            spots_sp:    settings.spots_sp    ?? 2,
            spots_rp:    settings.spots_rp    ?? 2,
            spots_p:     settings.spots_p     ?? 0,
            spots_bench: settings.spots_bench ?? 4,
            spots_il:    settings.spots_il    ?? 2,
          }}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1 text-white">Season Schedule</h2>
        <p className="text-sm text-gray-400 mb-4">
          Generate the full regular season and playoff schedule. This also activates the league.
          You can regenerate if needed — it will overwrite the existing schedule.
        </p>
        <ScheduleGenerator leagueId={id} leagueStatus={league.status} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1 text-white">Add Team Accounts</h2>
        <p className="text-sm text-gray-400 mb-4">
          Create a login for each manager. You&apos;ll get a temporary password to share with them.
          They can change it from their Account Settings after signing in.
        </p>
        <TeamCreator leagueId={id} />
      </section>

      {playersWithNicknames.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-1 text-white">Player Nicknames</h2>
          <p className="text-sm text-gray-400 mb-4">
            Give players fun nicknames that show up in the chat and throughout the league.
            Only you and the co-commissioner can set these.
          </p>
          <NicknameManager leagueId={id} players={playersWithNicknames} />
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-1 text-white">Draft Pick Assets</h2>
        <p className="text-sm text-gray-400 mb-4">
          Generate tradeable draft picks for a future rookie draft season. Each team gets one pick
          per round. Picks can then be traded in the Trade Center.
        </p>
        <DraftPickGenerator leagueId={id} currentYear={league.season_year} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1 text-white">Scoring Categories</h2>
        <p className="text-sm text-gray-400 mb-4">
          Adjust point values, add new categories, or remove ones you don&apos;t use.
          Changes take effect immediately for all future scoring calculations.
        </p>
        <ScoringEditor leagueId={id} initialCategories={categories} />
      </section>
    </div>
  )
}
