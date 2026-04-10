import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: teams } = await supabase
    .from('fantasy_teams')
    .select(`
      *,
      leagues (id, name, status, season_year, scoring_type)
    `)
    .eq('owner_id', user!.id)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white">My Leagues</h1>

      {teams && teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team: any) => (
            <Link
              key={team.id}
              href={`/league/${team.league_id}`}
              className="block p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                  {team.leagues.season_year} Season
                </span>
                <StatusBadge status={team.leagues.status} />
              </div>
              <h2 className="text-lg font-semibold text-white">{team.name}</h2>
              <p className="text-gray-400 text-sm mt-1">{team.leagues.name}</p>
              <div className="mt-4 flex gap-4 text-sm">
                <span className="text-gray-300">
                  <span className="font-bold text-white">{team.wins}</span>
                  <span className="text-gray-500">-</span>
                  <span className="font-bold text-white">{team.losses}</span>
                  {team.ties > 0 && <span className="text-gray-300">-{team.ties}</span>}
                </span>
                <span className="text-gray-400">
                  {team.points_for.toFixed(1)} pts
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-4">You&apos;re not in any leagues yet.</p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/league/create"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors text-white"
            >
              Create a League
            </Link>
            <Link
              href="/league/join"
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors text-white"
            >
              Join a League
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    setup: 'bg-yellow-900 text-yellow-300',
    drafting: 'bg-purple-900 text-purple-300',
    active: 'bg-green-900 text-green-300',
    offseason: 'bg-gray-800 text-gray-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? styles.offseason}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
