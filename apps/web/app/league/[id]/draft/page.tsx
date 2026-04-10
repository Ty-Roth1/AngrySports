import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { OfflineDraftBoard } from '@/components/draft/OfflineDraftBoard'

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select(`
      *,
      league_settings (*),
      fantasy_teams (id, name, abbreviation, owner_id, faab_remaining,
        profiles (display_name))
    `)
    .eq('id', id)
    .single()

  if (!league) notFound()

  const isCommissioner = league.commissioner_id === user.id

  // Get active draft if one exists
  const { data: activeDraft } = await supabase
    .from('drafts')
    .select('*, draft_picks(*, players(full_name, primary_position, mlb_team))')
    .eq('league_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Draft Room</h1>
          <p className="text-gray-400 text-sm mt-1">{league.name}</p>
        </div>
      </div>

      {!activeDraft && isCommissioner && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Start a Draft</h2>
          <p className="text-sm text-gray-400">
            Choose how you want to run your draft. The offline option lets you enter picks manually —
            perfect for in-person drafts or when you want full control.
          </p>
          <StartDraftButtons leagueId={id} />
        </div>
      )}

      {activeDraft && (
        <OfflineDraftBoard
          draft={activeDraft}
          league={league}
          teams={league.fantasy_teams}
          isCommissioner={isCommissioner}
          leagueId={id}
        />
      )}

      {!activeDraft && !isCommissioner && (
        <div className="text-center py-20 text-gray-500">
          <p>The commissioner hasn&apos;t started the draft yet.</p>
        </div>
      )}
    </div>
  )
}

function StartDraftButtons({ leagueId }: { leagueId: string }) {
  return (
    <div className="flex gap-3">
      <a
        href={`/league/${leagueId}/draft/start?mode=offline&phase=free_agency`}
        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
      >
        Start Offline Draft (Manual Entry)
      </a>
      <a
        href={`/league/${leagueId}/draft/start?mode=offline&phase=rookie_draft`}
        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors"
      >
        Start Rookie Draft (Manual Entry)
      </a>
    </div>
  )
}
