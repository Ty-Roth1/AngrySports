import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/leagues/[id]/teams/[teamId]
// Body: { name?: string, abbreviation?: string }
// Team owner can rename their own team. Commissioner can rename any team.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  const { id: leagueId, teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('id, owner_id, league_id')
    .eq('id', teamId)
    .eq('league_id', leagueId)
    .single()

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  // Must be team owner or commissioner
  if (team.owner_id !== user.id) {
    const { data: league } = await supabase
      .from('leagues')
      .select('commissioner_id, co_commissioner_id')
      .eq('id', leagueId)
      .single()
    const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
    if (!isCommish) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const update: Record<string, string> = {}
  if (body.name?.trim())         update.name = body.name.trim()
  if (body.abbreviation?.trim()) update.abbreviation = body.abbreviation.trim().toUpperCase().slice(0, 4)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase.from('fantasy_teams').update(update).eq('id', teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...update })
}
