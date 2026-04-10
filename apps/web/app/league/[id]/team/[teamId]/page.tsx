import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LeagueNav } from '@/components/league/LeagueNav'

// Position display order for roster
const POSITION_ORDER = ['C','1B','2B','SS','3B','IF','OF','DH','UTIL','SP','RP','P','BENCH','IL','TAXI','NA']

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>
}) {
  const { id: leagueId, teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, commissioner_id, co_commissioner_id')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('id, name, abbreviation, wins, losses, ties, points_for, owner_id')
    .eq('id', teamId)
    .eq('league_id', leagueId)
    .single()
  if (!team) notFound()

  const { data: rosterRows } = await supabase
    .from('rosters')
    .select(`
      id, slot_type,
      players(id, mlb_id, full_name, primary_position, mlb_team, status, is_rookie, is_second_year)
    `)
    .eq('team_id', teamId)
    .order('slot_type')

  const isCommissioner = league.commissioner_id === user.id || league.co_commissioner_id === user.id

  // Sort by position order
  const sorted = (rosterRows ?? []).slice().sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.slot_type)
    const bi = POSITION_ORDER.indexOf(b.slot_type)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const SLOT_LABELS: Record<string, string> = {
    C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS',
    IF: 'IF', OF: 'OF', UTIL: 'UTIL',
    SP: 'SP', RP: 'RP', P: 'P',
    BENCH: 'BN', IL: 'IL', TAXI: 'TX', NA: 'NA',
  }

  const STATUS_STYLES: Record<string, string> = {
    active: 'text-green-400', injured: 'text-red-400',
    minors: 'text-yellow-400', inactive: 'text-gray-500',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <p className="text-gray-400 text-sm mt-1">
            {league.name} · {team.wins}–{team.losses} · {team.points_for?.toFixed(1) ?? '0.0'} pts
          </p>
        </div>
        <Link
          href={`/league/${leagueId}/standings`}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Standings
        </Link>
      </div>

      <LeagueNav leagueId={leagueId} active="" isCommissioner={isCommissioner} />

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/40">
          <h3 className="font-semibold text-sm text-white">
            Roster
            <span className="ml-2 text-xs font-normal text-gray-400">
              {sorted.length} player{sorted.length !== 1 ? 's' : ''}
            </span>
          </h3>
        </div>
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-3 py-2 w-10">Slot</th>
              <th className="text-left px-3 py-2">Player</th>
              <th className="text-left px-3 py-2 w-24">Position</th>
              <th className="text-left px-3 py-2 w-20">Team</th>
              <th className="text-left px-3 py-2 w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                  No players on this roster.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => {
                const p = r.players as any
                if (!p) return null
                return (
                  <tr key={r.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono font-bold text-gray-500">
                        {SLOT_LABELS[r.slot_type] ?? r.slot_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="relative w-7 h-7 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                          <Image
                            src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_60,q_auto:best/v1/people/${p.mlb_id}/headshot/67/current`}
                            alt={p.full_name}
                            fill
                            className="object-cover object-center"
                            unoptimized
                          />
                        </div>
                        <div>
                          <Link
                            href={`/players/${p.id}`}
                            className="font-medium text-white hover:text-red-400 transition-colors text-sm"
                          >
                            {p.full_name}
                          </Link>
                          {p.is_second_year
                            ? <span className="ml-1 text-xs text-blue-400">2nd</span>
                            : p.is_rookie && <span className="ml-1 text-xs font-bold text-yellow-400">R</span>
                          }
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-400">{p.primary_position}</td>
                    <td className="px-3 py-2 text-sm text-gray-400">{p.mlb_team ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? 'text-gray-400'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
