import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeagueNav } from '@/components/league/LeagueNav'

const TYPE_LABEL: Record<string, string> = {
  add: 'Add',
  drop: 'Drop',
  trade: 'Trade',
  waiver_claim: 'Waiver',
  commissioner: 'Commissioner',
}

const TYPE_COLOR: Record<string, string> = {
  add: 'text-green-400 bg-green-900/30',
  drop: 'text-red-400 bg-red-900/30',
  trade: 'text-blue-400 bg-blue-900/30',
  waiver_claim: 'text-yellow-400 bg-yellow-900/20',
  commissioner: 'text-gray-400 bg-gray-800',
}

export default async function TransactionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  // Check membership
  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .maybeSingle()

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id, type, status, notes, created_at, processed_at,
      initiated_by_team:initiated_by_team_id (name, abbreviation),
      transaction_items (
        player_id, faab_bid,
        from_team:from_team_id (name, abbreviation),
        to_team:to_team_id (name, abbreviation),
        players (full_name, primary_position)
      )
    `)
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Transactions</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name}</p>
      </div>

      <LeagueNav leagueId={leagueId} active="transactions" />

      {!transactions || transactions.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          No transactions yet.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-800">
            {transactions.map((txn: any) => (
              <div key={txn.id} className="px-5 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${TYPE_COLOR[txn.type] ?? 'text-gray-400 bg-gray-800'}`}>
                      {TYPE_LABEL[txn.type] ?? txn.type}
                    </span>
                    <span className="text-sm text-gray-400">
                      {txn.initiated_by_team?.name ?? '—'}
                    </span>
                    {txn.notes && <span className="text-xs text-gray-600">· {txn.notes}</span>}
                  </div>
                  <span className="text-xs text-gray-600">
                    {new Date(txn.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Transaction items */}
                <div className="space-y-1 ml-1">
                  {(txn.transaction_items ?? []).map((item: any, i: number) => {
                    const player = item.players
                    const toTeam = item.to_team
                    const fromTeam = item.from_team
                    const isAdd = !fromTeam && toTeam
                    const isDrop = fromTeam && !toTeam
                    const isMove = fromTeam && toTeam

                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {isAdd && <span className="text-green-400 text-xs w-4">+</span>}
                        {isDrop && <span className="text-red-400 text-xs w-4">−</span>}
                        {isMove && <span className="text-blue-400 text-xs w-4">→</span>}
                        <span className="text-white font-medium">{player?.full_name}</span>
                        <span className="text-gray-500 text-xs">{player?.primary_position}</span>
                        {isAdd && <span className="text-gray-400 text-xs">→ {toTeam?.name}</span>}
                        {isDrop && <span className="text-gray-400 text-xs">from {fromTeam?.name}</span>}
                        {isMove && (
                          <span className="text-gray-400 text-xs">{fromTeam?.name} → {toTeam?.name}</span>
                        )}
                        {item.faab_bid != null && (
                          <span className="text-green-400 text-xs ml-1">${item.faab_bid} FAAB</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
