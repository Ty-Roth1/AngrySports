import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/leagues/[id]/nicknames
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('player_nicknames')
    .select('player_id, nickname, players(full_name, primary_position)')
    .eq('league_id', leagueId)

  return NextResponse.json({ nicknames: data ?? [] })
}

// POST /api/leagues/[id]/nicknames
// Commissioner/co-commish only. Body: { player_id, nickname }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id, co_commissioner_id')
    .eq('id', leagueId)
    .single()

  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
  const isCommish = league.commissioner_id === user.id || league.co_commissioner_id === user.id
  if (!isCommish) return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })

  const body = await request.json()
  const { player_id, nickname } = body
  if (!player_id || !nickname?.trim()) {
    return NextResponse.json({ error: 'player_id and nickname required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('player_nicknames')
    .upsert({
      league_id: leagueId,
      player_id,
      nickname: nickname.trim(),
      set_by: user.id,
    }, { onConflict: 'league_id,player_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ nickname: data })
}

// DELETE /api/leagues/[id]/nicknames
// Body: { player_id }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id, co_commissioner_id')
    .eq('id', leagueId)
    .single()

  const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
  if (!isCommish) return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })

  const body = await request.json()
  const { player_id } = body
  if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 })

  await supabase
    .from('player_nicknames')
    .delete()
    .eq('league_id', leagueId)
    .eq('player_id', player_id)

  return NextResponse.json({ ok: true })
}
