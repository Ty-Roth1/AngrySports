'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  profile: { display_name: string; avatar_url: string | null } | null
}

export function TopBar({ profile }: TopBarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const parts = pathname.split('/')
  const leagueId = parts[1] === 'league' && parts[2] ? parts[2] : null

  const [leagueName, setLeagueName] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueId) { setLeagueName(null); return }
    const supabase = createClient()
    supabase
      .from('leagues')
      .select('name')
      .eq('id', leagueId)
      .single()
      .then(({ data }) => setLeagueName(data?.name ?? null))
  }, [leagueId])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Show a back button on detail pages that aren't reachable from the bottom nav
  const isDetailPage =
    /^\/players\/[^/]+/.test(pathname) ||           // player detail
    /^\/league\/[^/]+\/team\//.test(pathname) ||    // team page
    /^\/league\/[^/]+\/trades\/[^/]+/.test(pathname) || // trade detail
    pathname === '/account' ||
    pathname === '/settings'

  return (
    <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900 pt-safe">
      <div className="h-14 grid grid-cols-3 items-center px-6">

      {/* Left: back button on detail pages, league name otherwise */}
      <div className="flex items-center gap-2">
        {isDetailPage ? (
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        ) : leagueName ? (
          <span className="text-sm text-gray-400 truncate">{leagueName}</span>
        ) : null}
      </div>

      {/* Center: brand logo */}
      <div className="flex justify-center">
        <Link href="/dashboard" className="text-lg font-extrabold tracking-tight text-white hover:opacity-80 transition-opacity">
          Angry<span className="text-red-500">Sports</span>
        </Link>
      </div>

      {/* Right: account */}
      <div className="flex items-center justify-end gap-3">
        <Link href="/account" className="text-sm text-gray-300 hover:text-white transition-colors">
          {profile?.display_name}
        </Link>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>

      </div>
    </header>
  )
}
