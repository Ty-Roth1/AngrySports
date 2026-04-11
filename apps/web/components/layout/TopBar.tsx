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

  // Extract league id from URL if present
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

  return (
    <header className="h-14 relative flex items-center justify-between px-6 border-b border-gray-800 bg-gray-900 flex-shrink-0">

      {/* Left: league name + 12AM (when inside a league) */}
      <div className="flex items-center gap-2 min-w-0">
        {leagueName && (
          <>
            <span className="text-sm text-gray-400 truncate max-w-[200px]">{leagueName}</span>
            <span
              style={{ fontFamily: 'var(--font-orbitron)', letterSpacing: '0.1em' }}
              className="text-sm font-bold flex-shrink-0"
            >
              <span className="text-white">12</span>
              <span className="text-red-500">AM</span>
            </span>
          </>
        )}
      </div>

      {/* Center: AngrySports logo */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none select-none">
        <Link href="/dashboard" className="pointer-events-auto">
          <span className="text-xl font-extrabold tracking-tight text-white">
            Angry<span className="text-red-500">Sports</span>
          </span>
        </Link>
      </div>

      {/* Right: account */}
      <div className="flex items-center gap-3">
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
    </header>
  )
}
