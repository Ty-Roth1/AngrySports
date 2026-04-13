import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

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
        {/* Extra top padding on mobile for status bar */}
        <main className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  )
}
