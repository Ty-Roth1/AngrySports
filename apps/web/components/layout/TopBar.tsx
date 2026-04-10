'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  profile: { display_name: string; avatar_url: string | null } | null
}

export function TopBar({ profile }: TopBarProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-gray-800 bg-gray-900 flex-shrink-0">
      <div />
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
