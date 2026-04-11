import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { fetchPlayerDetail, fetchPlayerStats, fetchStatcastData } from '@/lib/mlb'
import { PlayerCardBack } from '@/components/player/PlayerCardBack'
import { PercentileBars } from '@/components/player/PercentileBars'
import { CareerStatsTable } from '@/components/player/CareerStatsTable'
import { FantasyHistory } from '@/components/player/FantasyHistory'
import { ContractEditForm } from '@/components/player/ContractEditForm'
import { FantasyStatsPanel } from '@/components/player/FantasyStatsPanel'
import { BackButton } from '@/components/BackButton'
import { NicknameEditor } from '@/components/player/NicknameEditor'
import Image from 'next/image'

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get player from our DB
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single()

  if (!player) notFound()

  // Get fantasy contract (most recent active)
  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id, league_id, salary, years_total, years_remaining, expires_after_season, contract_type,
      fantasy_teams (id, name, abbreviation, owner_id,
        leagues (id, name, season_year))
    `)
    .eq('player_id', id)
    .is('voided_at', null)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const canEditContract = user && contract &&
    (user.id === (contract.fantasy_teams as any)?.owner_id)

  // Find the current user's roster entry for this player (for nickname editing)
  const { data: myRosterEntry } = user ? await supabase
    .from('rosters')
    .select('id, nickname, fantasy_teams!inner(owner_id)')
    .eq('player_id', id)
    .eq('fantasy_teams.owner_id', user.id)
    .maybeSingle() : { data: null }

  // Get fantasy team history (all rosters this player has been on)
  const { data: rosterHistory } = await supabase
    .from('rosters')
    .select(`
      acquisition_type, acquired_at,
      fantasy_teams (id, name, abbreviation,
        leagues (id, name, season_year))
    `)
    .eq('player_id', id)
    .order('acquired_at', { ascending: false })

  // Get all contracts (history)
  const { data: contractHistory } = await supabase
    .from('contracts')
    .select(`
      salary, years_total, years_remaining, contract_type, signed_at, expires_after_season,
      fantasy_teams (name, abbreviation,
        leagues (name, season_year))
    `)
    .eq('player_id', id)
    .order('signed_at', { ascending: false })

  const isPitcher = ['SP', 'RP'].includes(player.primary_position)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // Fetch fantasy game scores for this player
  const [fantasyScoresResult] = await Promise.all([
    supabase
      .from('player_game_scores')
      .select('fantasy_points, raw_stats, mlb_game_id, game_date')
      .eq('player_id', id)
      .order('game_date', { ascending: false })
      .limit(200),
  ])
  const fantasyScores = fantasyScoresResult.data ?? []

  // Rankings are pre-computed by the rankings sync (admin panel → Sync Player Rankings)
  const ovrRank = (player as any).rank          as number | null
  const posRank = (player as any).position_rank as number | null
  const ovrLabel = isPitcher ? 'P' : 'OVR'

  // Season pts: sum actual game scores (same source as Fantasy Stats section)
  const season = new Date().getFullYear()
  const actualSeasonPts = fantasyScores
    .filter(s => s.game_date?.startsWith(String(season)))
    .reduce((sum, s) => sum + Number(s.fantasy_points), 0)

  // Fetch from MLB API + Savant in parallel
  const [mlbDetail, mlbStats, statcast] = await Promise.all([
    fetchPlayerDetail(player.mlb_id),
    fetchPlayerStats(player.mlb_id),
    fetchStatcastData(player.mlb_id, isPitcher),
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Close / back button */}
      <div className="flex justify-end">
        <BackButton className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors text-base" />
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
          <Image
            src={player.photo_url ?? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.mlb_id}/headshot/67/current`}
            alt={player.full_name}
            fill
            className="object-cover object-center"
            unoptimized
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{player.full_name}</h1>
            {player.is_rookie && (
              <span className="px-2 py-0.5 bg-yellow-800 text-yellow-300 text-xs font-semibold rounded">
                ROOKIE
              </span>
            )}
          </div>
          {/* Fantasy rankings — pre-computed from season MLB stats via rankings sync */}
          {(ovrRank || seasonPts) && (
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {ovrRank && (
                <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-200 text-xs font-bold rounded font-mono">
                  #{ovrRank} {ovrLabel}
                </span>
              )}
              {!isPitcher && posRank && (
                <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-red-300 text-xs font-bold rounded font-mono">
                  #{posRank} {player.primary_position}
                </span>
              )}
              {actualSeasonPts > 0 && (
                <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 text-yellow-300 text-xs font-bold rounded font-mono">
                  {actualSeasonPts.toFixed(1)} pts
                </span>
              )}
            </div>
          )}
          {myRosterEntry && (
            <NicknameEditor
              rosterId={myRosterEntry.id}
              initialNickname={(myRosterEntry as any).nickname ?? null}
            />
          )}
          <p className="text-gray-400 text-lg">
            {(() => {
              const eligible: string[] = player.eligible_positions ?? []
              const posOrder = ['C','1B','2B','SS','3B','OF','DH','SP','RP']
              const display = eligible.length > 1
                ? [...eligible].sort((a, b) => (posOrder.indexOf(a) + 1 || 99) - (posOrder.indexOf(b) + 1 || 99)).join('/')
                : player.primary_position
              return display
            })()}
            {' · '}{player.mlb_team ?? 'Free Agent'}
            {player.jersey_number ? ` · #${player.jersey_number}` : ''}
          </p>
          {mlbDetail && (
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-400">
              {mlbDetail.currentAge && <span>Age {mlbDetail.currentAge}</span>}
              {mlbDetail.height && mlbDetail.weight && (
                <span>{mlbDetail.height}, {mlbDetail.weight} lbs</span>
              )}
              {mlbDetail.batSide && !isPitcher && <span>Bats {mlbDetail.batSide.description}</span>}
              {mlbDetail.pitchHand && isPitcher && <span>Throws {mlbDetail.pitchHand.description}</span>}
              {mlbDetail.mlbDebutDate && (
                <span>Debut {new Date(mlbDetail.mlbDebutDate).getFullYear()}</span>
              )}
              {mlbDetail.birthCity && (
                <span>Born {mlbDetail.birthCity}{mlbDetail.birthStateProvince ? `, ${mlbDetail.birthStateProvince}` : ''}</span>
              )}
            </div>
          )}
        </div>

        {/* Current fantasy team badge */}
        {contract && (
          <div className="flex-shrink-0 bg-gray-900 border border-gray-700 rounded-xl p-4 text-right">
            <p className="text-xs text-gray-400 mb-1">Fantasy Team</p>
            <p className="text-sm font-semibold text-white">{(contract.fantasy_teams as any)?.name}</p>
            <p className="text-xs text-gray-500">{(contract.fantasy_teams as any)?.leagues?.name}</p>
          </div>
        )}
      </div>

      {/* Fantasy stats */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Fantasy Stats</h2>
        <FantasyStatsPanel
          scores={fantasyScores as any}
          isPitcher={isPitcher}
          today={today}
        />
      </section>

      {/* Percentile bars — Savant style */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>Percentile Rankings</span>
          <span className="text-xs text-gray-500 font-normal">(current season vs. MLB)</span>
        </h2>
        <PercentileBars
          isPitcher={isPitcher}
          batting={mlbStats.batting[0] ?? null}
          pitching={mlbStats.pitching[0] ?? null}
          statcast={statcast}
        />
      </section>

      {/* Baseball card back */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Player Card</h2>
        <PlayerCardBack
          player={player}
          mlbDetail={mlbDetail}
          careerBatting={mlbStats.careerBatting}
          careerPitching={mlbStats.careerPitching}
          isPitcher={isPitcher}
        />
      </section>

      {/* Career stats table */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Career Stats</h2>
        <CareerStatsTable
          batting={mlbStats.batting}
          pitching={mlbStats.pitching}
          isPitcher={isPitcher}
        />
      </section>

      {/* Fantasy contract — always show section */}
      <section>
          <h2 className="text-lg font-semibold mb-4">Fantasy Contract</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {contract && (
              <div className="px-5 py-4 border-b border-gray-800">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Current Contract</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Salary (AAV)</p>
                    <p className="text-xl font-bold text-green-400">${contract.salary}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Years Remaining</p>
                    <p className="text-xl font-bold text-white">{contract.years_remaining}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expires After</p>
                    <p className="text-xl font-bold text-white">{contract.expires_after_season}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Team</p>
                    <p className="text-sm font-semibold text-white">{(contract.fantasy_teams as any)?.name}</p>
                    <p className="text-xs text-gray-500">{(contract.fantasy_teams as any)?.leagues?.name}</p>
                  </div>
                </div>
                {canEditContract && (
                  <ContractEditForm contract={{
                    id: contract.id,
                    league_id: contract.league_id,
                    salary: Number(contract.salary),
                    years_total: contract.years_total,
                    years_remaining: contract.years_remaining,
                    expires_after_season: contract.expires_after_season,
                    contract_type: contract.contract_type,
                  }} />
                )}
              </div>
            )}

            {contractHistory && contractHistory.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Contract History</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2">Team</th>
                      <th className="text-left pb-2">League</th>
                      <th className="text-right pb-2">Salary</th>
                      <th className="text-right pb-2">Years</th>
                      <th className="text-right pb-2">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractHistory.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/50 last:border-0">
                        <td className="py-2 text-gray-300">{c.fantasy_teams?.abbreviation ?? c.fantasy_teams?.name ?? '—'}</td>
                        <td className="py-2 text-gray-500 text-xs">{c.fantasy_teams?.leagues?.name ?? '—'}</td>
                        <td className="py-2 text-right text-green-400">${c.salary}</td>
                        <td className="py-2 text-right text-gray-400">{c.years_total}</td>
                        <td className="py-2 text-right text-gray-400">{c.expires_after_season}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          {/* No contract state */}
          {!contract && (!contractHistory || contractHistory.length === 0) && (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              No fantasy contract on file. Assign one from your team&apos;s Payroll view.
            </div>
          )}
          </div>
      </section>

      {/* Fantasy history */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Fantasy History</h2>
        <FantasyHistory
          rosterHistory={(rosterHistory ?? []) as any}
          contractHistory={(contractHistory ?? []) as any}
        />
      </section>
    </div>
  )
}
