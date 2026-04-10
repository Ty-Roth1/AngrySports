interface RosterEntry {
  acquisition_type: string
  acquired_at: string
  fantasy_teams: {
    id: string
    name: string
    abbreviation: string
    leagues: { id: string; name: string; season_year: number } | null
  } | null
}

interface ContractEntry {
  salary: number
  years_total: number
  years_remaining: number
  contract_type: string
  signed_at: string
  expires_after_season: number
  fantasy_teams: {
    name: string
    abbreviation: string
    leagues: { name: string; season_year: number } | null
  } | null
}

const ACQ_LABEL: Record<string, string> = {
  draft: 'Drafted',
  waiver: 'Waiver Claim',
  trade: 'Trade',
  free_agent: 'Free Agent Signing',
  commissioner: 'Commissioner',
}

export function FantasyHistory({ rosterHistory, contractHistory }: {
  rosterHistory: RosterEntry[]
  contractHistory: ContractEntry[]
}) {
  if (rosterHistory.length === 0 && contractHistory.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
        This player has no fantasy history yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Roster / team history */}
      {rosterHistory.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/50">
            <h3 className="font-semibold text-sm">Fantasy Team History</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {rosterHistory.map((entry, i) => {
              const team = entry.fantasy_teams
              const league = team?.leagues
              return (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{team?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {league?.name} · {league?.season_year}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                      {ACQ_LABEL[entry.acquisition_type] ?? entry.acquisition_type}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(entry.acquired_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Contract history */}
      {contractHistory.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/50">
            <h3 className="font-semibold text-sm">Contract History</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {contractHistory.map((c, i) => {
              const team = c.fantasy_teams
              const league = team?.leagues
              const isExpired = c.expires_after_season < new Date().getFullYear()
              return (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-green-400 text-lg">${c.salary}</span>
                        <span className="text-sm text-gray-400">
                          / {c.years_total} yr{c.years_total !== 1 ? 's' : ''}
                        </span>
                        {isExpired
                          ? <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded">Expired</span>
                          : <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded">Active</span>
                        }
                      </div>
                      <p className="text-sm text-gray-300 mt-0.5">{team?.name}</p>
                      <p className="text-xs text-gray-500">{league?.name} · {league?.season_year}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>Signed {new Date(c.signed_at).toLocaleDateString()}</p>
                      <p>Expires after {c.expires_after_season}</p>
                      <p className="mt-0.5 capitalize text-gray-400">{c.contract_type}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
