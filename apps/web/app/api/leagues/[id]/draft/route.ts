import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/draft — create or get the active draft
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify commissioner
  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id, league_settings(draft_type, auction_budget, pick_time_seconds, rookie_draft_rounds)')
    .eq('id', leagueId)
    .single()

  if (!league || league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { phase = 'free_agency', is_offline = false } = body

  const settings = (league.league_settings as any)

  const { data: draft, error } = await supabase
    .from('drafts')
    .insert({
      league_id: leagueId,
      phase,
      draft_type: phase === 'rookie_draft' ? 'snake' : settings.draft_type,
      status: 'active',
      pick_time_seconds: is_offline ? 0 : settings.pick_time_seconds,
      is_offline,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft })
}
