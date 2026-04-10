import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pos?: string }>
}) {
  const { q, pos } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('players')
    .select('id, full_name, primary_position, mlb_team, mlb_id, status, is_rookie')
    .neq('status', 'inactive')
    .order('full_name')
    .limit(50)

  if (q) query = query.ilike('full_name', `%${q}%`)
  if (pos) query = query.eq('primary_position', pos)

  const { data: players } = await query

  const positions = ['C','1B','2B','3B','SS','OF','SP','RP','DH']

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Players</h1>

      {/* Search + filter */}
      <form className="flex gap-3 mb-6">
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
        <button type="submit"
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
          Search
        </button>
      </form>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-800">
              <th className="text-left px-5 py-3">Player</th>
              <th className="text-left px-5 py-3">Pos</th>
              <th className="text-left px-5 py-3">Team</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {!players || players.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-gray-500">
                  No players found. Try syncing players from the admin page.
                </td>
              </tr>
            ) : players.map(p => (
              <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/players/${p.id}`} className="font-medium text-white hover:text-red-400 transition-colors">
                    {p.full_name}
                  </Link>
                  {p.is_rookie && (
                    <span className="ml-2 text-xs text-yellow-400">R</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-400">{p.primary_position}</td>
                <td className="px-5 py-3 text-gray-400">{p.mlb_team ?? '—'}</td>
                <td className="px-5 py-3">
                  <StatusDot status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'text-green-400',
    injured: 'text-red-400',
    minors: 'text-yellow-400',
    inactive: 'text-gray-500',
  }
  return <span className={`text-xs font-medium capitalize ${styles[status] ?? 'text-gray-400'}`}>{status}</span>
}
