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

  // Fetch league settings for slot eligibility + capacity
  const [{ data: settings }, { data: leagueRow }] = await Promise.all([
    supabase
      .from('league_settings')
      .select('spots_c, spots_1b, spots_2b, spots_3b, spots_ss, spots_if, spots_of, spots_util, spots_sp, spots_rp, spots_p')
      .eq('league_id', leagueId)
      .single(),
    supabase
      .from('leagues')
      .select('has_taxi_squad')
      .eq('id', leagueId)
      .single(),
  ])

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

  // For fixed-capacity active slots, check if the slot is already full.
  // If so, displace one occupant to BENCH before moving the new player in.
  const SLOT_CAPACITY: Record<string, number> = {
    C:    settings?.spots_c    ?? 1,
    '1B': settings?.spots_1b   ?? 1,
    '2B': settings?.spots_2b   ?? 1,
    '3B': settings?.spots_3b   ?? 1,
    SS:   settings?.spots_ss   ?? 1,
    IF:   settings?.spots_if   ?? 0,
    OF:   settings?.spots_of   ?? 3,
    UTIL: settings?.spots_util ?? 1,
    SP:   settings?.spots_sp   ?? 2,
    RP:   settings?.spots_rp   ?? 2,
    P:    settings?.spots_p    ?? 0,
  }

  const capacity = SLOT_CAPACITY[slot_type]
  if (capacity !== undefined && capacity > 0) {
    // Count players already in this slot (excluding the player being moved)
    const { data: occupants } = await supabase
      .from('rosters')
      .select('id')
      .eq('team_id', entry.team_id)
      .eq('slot_type', slot_type)
      .neq('id', roster_id)

    if (occupants && occupants.length >= capacity) {
      // Displace the first occupant to BENCH
      const { error: displaceError } = await supabase
        .from('rosters')
        .update({ slot_type: 'BENCH' })
        .eq('id', occupants[0].id)

      if (displaceError) return NextResponse.json({ error: displaceError.message }, { status: 500 })
    }
  }

  const { error } = await supabase
    .from('rosters')
    .update({ slot_type })
    .eq('id', roster_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, slot_type })
}
