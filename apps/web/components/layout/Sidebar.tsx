'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Sidebar() {
  const pathname = usePathname()

  // Detect current league from URL: /league/[id]/...
  const parts = pathname.split('/')
  const leagueId = parts[1] === 'league' && parts[2] ? parts[2] : null

  const nav = [
    { label: 'Dashboard',  href: '/dashboard',       icon: '⚾', always: true },
    { label: 'Players',    href: '/players',          icon: '🔍', always: true },
    // League-specific (only shown when inside a league)
    { label: 'My Roster',  href: leagueId ? `/league/${leagueId}/roster`       : null, icon: '👥' },
    { label: 'Matchup',    href: leagueId ? `/league/${leagueId}/matchup`       : null, icon: '⚔️' },
    { label: 'Standings',  href: leagueId ? `/league/${leagueId}/standings`     : null, icon: '🏆' },
    { label: 'Waivers',    href: leagueId ? `/league/${leagueId}/waivers`       : null, icon: '📋' },
    { label: 'Draft',      href: leagueId ? `/league/${leagueId}/draft`         : null, icon: '📝' },
    { label: 'Transactions', href: leagueId ? `/league/${leagueId}/transactions` : null, icon: '📜' },
    { label: 'Settings',   href: leagueId ? `/league/${leagueId}/settings`      : null, icon: '⚙️' },
  ].filter(item => item.always || item.href !== null)

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <Link href="/dashboard">
          <span className="text-xl font-extrabold tracking-tight text-white">
            Angry<span className="text-red-500">Sports</span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {leagueId && (
          <div className="px-4 py-1.5 mb-1">
            <Link href={`/league/${leagueId}`} className="text-xs text-gray-500 hover:text-gray-300 uppercase tracking-wide transition-colors">
              League Home
            </Link>
          </div>
        )}
        {nav.map(item => {
          if (!item.href) return null
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        {!leagueId && (
          <div className="px-4 py-3 mt-2 border-t border-gray-800">
            <p className="text-xs text-gray-600">Select a league from the dashboard to see league tools.</p>
          </div>
        )}
      </nav>
    </aside>
  )
}
