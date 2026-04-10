import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeagueNav } from '@/components/league/LeagueNav'
import { LeagueChat } from '@/components/league/LeagueChat'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, commissioner_id, co_commissioner_id')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Verify user is in the league (has a team or is commissioner)
  const { data: myTeam } = await supabase
    .from('fantasy_teams')
    .select('id')
    .eq('league_id', leagueId)
    .eq('owner_id', user.id)
    .maybeSingle()

  const isCommissioner = league.commissioner_id === user.id || league.co_commissioner_id === user.id
  if (!myTeam && !isCommissioner) {
    redirect(`/league/${leagueId}`)
  }

  // Load initial messages (last 50)
  const { data: initialMessages } = await supabase
    .from('league_chat_messages')
    .select('id, body, created_at, edited_at, deleted_at, user_id, profiles(display_name, avatar_url)')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Load reactions for initial messages
  const messageIds = (initialMessages ?? []).map(m => m.id)
  let initialReactions: any[] = []
  if (messageIds.length > 0) {
    const { data: reactions } = await supabase
      .from('league_chat_reactions')
      .select('id, message_id, user_id, emoji')
      .in('message_id', messageIds)
    initialReactions = reactions ?? []
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">League Chat</h1>
        <p className="text-gray-400 text-sm mt-1">{league.name}</p>
      </div>

      <LeagueNav leagueId={leagueId} active="chat" />

      <LeagueChat
        leagueId={leagueId}
        currentUserId={user.id}
        currentUserName={profile?.display_name ?? 'You'}
        initialMessages={(initialMessages ?? []).reverse().map(m => ({
          ...m,
          profile: m.profiles as any,
        }))}
        initialReactions={initialReactions}
      />
    </div>
  )
}
