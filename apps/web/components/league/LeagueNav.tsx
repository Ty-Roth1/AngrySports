import Link from 'next/link'

const LINKS = [
  { label: 'Overview',        key: 'overview' },
  { label: 'My Roster',       key: 'roster' },
  { label: 'Matchup',         key: 'matchup' },
  { label: 'Standings',       key: 'standings' },
  { label: 'Players',         key: 'waivers' },
  { label: 'Transactions',    key: 'transactions' },
  { label: 'Trades',          key: 'trades' },
  { label: 'Chat',            key: 'chat' },
  { label: 'League Settings', key: 'info' },
  { label: 'Manage Rosters',  key: 'commissioner', commishOnly: true },
  { label: 'Settings',        key: 'settings', commishOnly: true },
]

export function LeagueNav({
  leagueId,
  active,
  isCommissioner = false,
}: {
  leagueId: string
  active: string
  isCommissioner?: boolean
}) {
  const hrefFor = (key: string) =>
    key === 'overview' ? `/league/${leagueId}` : `/league/${leagueId}/${key}`

  const visibleLinks = LINKS.filter(l => !l.commishOnly || isCommissioner)

  return (
    <nav className="flex flex-wrap gap-1 border-b border-gray-800">
      {visibleLinks.map(l => (
        <Link
          key={l.key}
          href={hrefFor(l.key)}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
            active === l.key
              ? 'bg-gray-800 text-white border-b-2 border-red-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
