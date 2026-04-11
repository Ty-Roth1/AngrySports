import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeagueNav } from '@/components/league/LeagueNav'

export default async function LeagueInfoPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Must be a member of this league
  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  const isCommissioner = league.commissioner_id === user.id || league.co_commissioner_id === user.id
  if (!myTeam && !isCommissioner) redirect(`/league/${id}`)

  const s = (league.league_settings as any) ?? {}

  const battingCats = (league.scoring_categories ?? [])
    .filter((c: any) => c.is_batting)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const pitchingCats = (league.scoring_categories ?? [])
    .filter((c: any) => c.is_pitching)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)

  const rosterRows: { label: string; value: number | string }[] = [
    { label: 'Catcher (C)',          value: s.spots_c     ?? 1 },
    { label: 'First Base (1B)',       value: s.spots_1b    ?? 1 },
    { label: 'Second Base (2B)',      value: s.spots_2b    ?? 1 },
    { label: 'Shortstop (SS)',        value: s.spots_ss    ?? 1 },
    { label: 'Third Base (3B)',       value: s.spots_3b    ?? 1 },
    { label: 'Infield (IF)',          value: s.spots_if    ?? 0 },
    { label: 'Outfield (OF)',         value: s.spots_of    ?? 3 },
    { label: 'Utility (UTIL)',        value: s.spots_util  ?? 1 },
    { label: 'Starting Pitcher (SP)', value: s.spots_sp    ?? 2 },
    { label: 'Relief Pitcher (RP)',   value: s.spots_rp    ?? 2 },
    { label: 'Pitcher (P)',           value: s.spots_p     ?? 0 },
    { label: 'Bench',                 value: s.spots_bench ?? 4 },
    { label: 'Injured List (IL)',     value: s.spots_il    ?? 2 },
  ].filter(r => Number(r.value) > 0)

  if (league.has_taxi_squad) rosterRows.push({ label: 'Taxi Squad', value: '✓' })

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-white">League Settings</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name} · {league.season_year} Season</p>
      </div>

      <LeagueNav leagueId={id} active="info" isCommissioner={isCommissioner} />

      {/* League overview */}
      <Section title="Overview">
        <Row label="League Name"       value={league.name} />
        <Row label="Season Year"       value={league.season_year} />
        <Row label="Status"            value={<StatusBadge status={league.status} />} />
        <Row label="Contract League"   value={league.is_contract_league ? 'Yes' : 'No'} />
        <Row label="Taxi Squad"        value={league.has_taxi_squad ? 'Yes' : 'No'} />
      </Section>

      {/* Waivers & transactions */}
      <Section title="Waivers & Transactions">
        <Row label="Waiver Type"       value={s.waiver_type === 'faab' ? 'FAAB (Free Agent Auction Bidding)' : 'Rolling waivers'} />
        {s.waiver_type === 'faab' && (
          <Row label="FAAB Budget"     value={`$${s.faab_budget ?? 500}`} />
        )}
        <Row label="Trade Deadline"    value={s.trade_deadline_week ? `After Week ${s.trade_deadline_week}` : 'None'} />
      </Section>

      {/* Roster configuration */}
      <Section title="Roster Spots">
        {rosterRows.map(r => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </Section>

      {/* Scoring — batting */}
      {battingCats.length > 0 && (
        <Section title="Scoring — Batting">
          {battingCats.map((c: any) => (
            <Row
              key={c.id}
              label={c.label}
              value={
                <span className={c.is_negative ? 'text-red-400' : 'text-green-400'}>
                  {c.is_negative ? '' : '+'}{c.points_per_unit} pts
                </span>
              }
            />
          ))}
        </Section>
      )}

      {/* Scoring — pitching */}
      {pitchingCats.length > 0 && (
        <Section title="Scoring — Pitching">
          {pitchingCats.map((c: any) => (
            <Row
              key={c.id}
              label={c.label}
              value={
                <span className={c.is_negative ? 'text-red-400' : 'text-green-400'}>
                  {c.is_negative ? '' : '+'}{c.points_per_unit} pts
                </span>
              }
            />
          ))}
        </Section>
      )}

      {/* Contract league rules */}
      {league.is_contract_league && (
        <Section title="Contract League">
          <Row label="Luxury Tax Threshold" value="$200M" />
          <Row label="200–209.9M" value="Draft pick pushed to end of round · Lose Young Player Extension" />
          <Row label="210–219.9M" value="Lose all draft picks · Lose HTD" />
          <Row label="220–229.9M" value="No additional penalties" />
          <Row label="230–239.9M" value="Can only keep 1 prospect" />
          <Row label="240M+"      value="Lose all prospects" />
          <p className="text-xs text-gray-500 pt-2 col-span-2">
            Penalties stack. Each consecutive year over $200M escalates your penalty to the next tier.
          </p>
        </Section>
      )}
    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        {children}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-white text-right">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:   'bg-green-900/50 text-green-400 border-green-800',
    drafting: 'bg-blue-900/50 text-blue-400 border-blue-800',
    setup:    'bg-gray-800 text-gray-400 border-gray-700',
    complete: 'bg-gray-800 text-gray-500 border-gray-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[status] ?? styles.setup}`}>
      {status}
    </span>
  )
}
