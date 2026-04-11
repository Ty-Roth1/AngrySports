import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/teams/[teamId]/history
// Body: { season_year, is_champion, finish_place, awards, notes }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('owner_id')
    .eq('id', teamId)
    .single()

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (team.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { season_year, is_champion, finish_place, awards, notes } = body

  if (!season_year) return NextResponse.json({ error: 'season_year required' }, { status: 400 })

  const { data, error } = await supabase
    .from('team_season_records')
    .upsert({
      team_id: teamId,
      season_year: Number(season_year),
      is_champion: !!is_champion,
      finish_place: finish_place ?? null,
      awards: Array.isArray(awards) ? awards.filter(Boolean) : [],
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'team_id,season_year' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/teams/[teamId]/history?year=2024
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: team } = await supabase
    .from('fantasy_teams')
    .select('owner_id')
    .eq('id', teamId)
    .single()

  if (!team || team.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const year = new URL(req.url).searchParams.get('year')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  await supabase
    .from('team_season_records')
    .delete()
    .eq('team_id', teamId)
    .eq('season_year', Number(year))

  return NextResponse.json({ ok: true })
}
