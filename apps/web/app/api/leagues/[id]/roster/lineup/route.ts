import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEligibleSlots } from '@/lib/scoring'

// PATCH /api/leagues/[id]/roster/lineup
// Body: { roster_id: string, slot_type: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { roster_id, slot_type } = body

  if (!roster_id || !slot_type) {
    return NextResponse.json({ error: 'Missing roster_id or slot_type' }, { status: 400 })
  }

  // Fetch the roster entry with player position, status, and rookie flags
  const { data: entry } = await supabase
    .from('rosters')
    .select('id, team_id, slot_type, player_id, players(primary_position, status, is_rookie, is_second_year)')
    .eq('id', roster_id)
    .single()

  if (!entry) return NextResponse.json({ error: 'Roster entry not found' }, { status: 404 })

  // Fetch the team to verify ownership and league
  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('id, owner_id, league_id')
    .eq('id', entry.team_id)
    .single()

  if (!team || team.league_id !== leagueId) {
    return NextResponse.json({ error: 'Wrong league' }, { status: 403 })
  }

  // Check authorization: must be team owner or commissioner
  if (team.owner_id !== user.id) {
    const { data: league } = await supabase
      .from('leagues')
      .select('commissioner_id, co_commissioner_id')
      .eq('id', leagueId)
      .single()
    const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
    if (!isCommish) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch league settings for slot eligibility
  const { data: settings } = await supabase
    .from('league_settings')
    .select('spots_if, spots_util, spots_p')
    .eq('league_id', leagueId)
    .single()

  const { data: leagueRow } = await supabase
    .from('leagues')
    .select('has_taxi_squad')
    .eq('id', leagueId)
    .single()

  const playerData = entry.players as any
  const position = playerData.primary_position as string

  const eligible = getEligibleSlots(
    position,
    {
      spots_if:   settings?.spots_if   ?? 0,
      spots_util: settings?.spots_util ?? 1,
      spots_p:    settings?.spots_p    ?? 0,
      spots_taxi: leagueRow?.has_taxi_squad ? 1 : 0,
    },
    {
      status:       playerData.status        ?? 'active',
      isRookie:     playerData.is_rookie     ?? false,
      isSecondYear: playerData.is_second_year ?? false,
    }
  )

  if (!eligible.includes(slot_type)) {
    return NextResponse.json(
      { error: `${position} cannot be placed in the ${slot_type} slot` },
      { status: 422 }
    )
  }

  const { error } = await supabase
    .from('rosters')
    .update({ slot_type })
    .eq('id', roster_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, slot_type })
}
