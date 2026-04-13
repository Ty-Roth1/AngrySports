'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

// Icons
function IconRoster()    { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> }
function IconMatchup()   { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> }
function IconPlayers()   { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> }
function IconStandings() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> }
function IconMore()      { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg> }
function IconDashboard() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> }

export function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const parts = pathname.split('/')
  const leagueId = parts[1] === 'league' && parts[2] ? parts[2] : null

  if (leagueId) {
    const hrefFor = (key: string) =>
      key === 'overview' ? `/league/${leagueId}` : `/league/${leagueId}/${key}`

    const isActive = (key: string) => {
      if (key === 'overview') return pathname === `/league/${leagueId}`
      return pathname.startsWith(`/league/${leagueId}/${key}`)
    }

    const mainTabs = [
      { key: 'roster',    label: 'Roster',    Icon: IconRoster },
      { key: 'matchup',   label: 'Matchup',   Icon: IconMatchup },
      { key: 'waivers',   label: 'Players',   Icon: IconPlayers },
      { key: 'standings', label: 'Standings', Icon: IconStandings },
    ]

    const moreTabs = [
      { key: 'overview',     label: 'League Overview' },
      { key: 'chat',         label: 'Chat' },
      { key: 'trades',       label: 'Trades' },
      { key: 'transactions', label: 'Transactions' },
      { key: 'info',         label: 'League Settings' },
    ]

    const moreActive = moreTabs.some(t => isActive(t.key))

    return (
      <>
        {/* More sheet overlay */}
        {moreOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setMoreOpen(false)}
            />
            {/* Sheet */}
            <div
              className="md:hidden fixed left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl"
              style={{ bottom: `calc(56px + env(safe-area-inset-bottom))` }}
            >
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mt-3 mb-2" />
              {moreTabs.map(({ key, label }) => (
                <Link
                  key={key}
                  href={hrefFor(key)}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center px-6 py-3.5 text-sm font-medium border-b border-gray-800 last:border-0 transition-colors ${
                    isActive(key) ? 'text-red-400' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Bottom bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-40"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {mainTabs.map(({ key, label, Icon }) => (
            <Link
              key={key}
              href={hrefFor(key)}
              onClick={() => setMoreOpen(false)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                isActive(key) ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              moreActive || moreOpen ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <IconMore />
            <span>More</span>
          </button>
        </nav>
      </>
    )
  }

  // Global tabs
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
