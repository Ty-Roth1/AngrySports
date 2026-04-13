'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Minimal SVG icons — no emoji, renders consistently on all iOS versions
function IconRoster()    { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> }
function IconMatchup()   { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> }
function IconPlayers()   { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> }
function IconStandings() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> }
function IconHome()      { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> }
function IconDashboard() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> }

export function BottomNav() {
  const pathname = usePathname()

  // Extract leagueId if inside a league route
  const parts = pathname.split('/')
  const leagueId = parts[1] === 'league' && parts[2] ? parts[2] : null

  if (leagueId) {
    // League-specific tabs
    const hrefFor = (key: string) =>
      key === 'overview' ? `/league/${leagueId}` : `/league/${leagueId}/${key}`

    const isActive = (key: string) => {
      if (key === 'overview') return pathname === `/league/${leagueId}`
      return pathname.startsWith(`/league/${leagueId}/${key}`)
    }

    const tabs = [
      { key: 'roster',    label: 'Roster',    Icon: IconRoster },
      { key: 'matchup',   label: 'Matchup',   Icon: IconMatchup },
      { key: 'waivers',   label: 'Players',   Icon: IconPlayers },
      { key: 'standings', label: 'Standings', Icon: IconStandings },
      { key: 'overview',  label: 'League',    Icon: IconHome },
    ]

    return (
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ key, label, Icon }) => {
          const active = isActive(key)
          return (
            <Link
              key={key}
              href={hrefFor(key)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  // Global tabs (dashboard, players)
  const globalTabs = [
    { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard,
      active: pathname === '/dashboard' || pathname === '/' },
    { href: '/players',   label: 'Players',   Icon: IconPlayers,
      active: pathname.startsWith('/players') },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {globalTabs.map(({ href, label, Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
            active ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Icon />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
