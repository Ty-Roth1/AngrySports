import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PullToRefresh } from '@/components/layout/PullToRefresh'

export default async function LeagueLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar profile={profile} />
        <PullToRefresh>
          {children}
        </PullToRefresh>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  )
}
