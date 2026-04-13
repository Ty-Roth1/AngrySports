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

  return (
    <header className="h-14 border-b border-gray-800 bg-gray-900 flex-shrink-0 grid grid-cols-3 items-center px-6">

      {/* Left: league name when inside a league */}
      <div className="flex items-center gap-2">
        {leagueName && (
          <span className="text-sm text-gray-400 truncate">{leagueName}</span>
        )}
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

    </header>
  )
}
