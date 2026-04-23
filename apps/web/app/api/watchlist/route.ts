import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/watchlist  { player_id } — add to watchlist
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { player_id } = await request.json()
  if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 })

  const { error } = await supabase
    .from('watchlist')
    .insert({ user_id: user.id, player_id })

  if (error && error.code !== '23505') { // ignore duplicate
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/watchlist  { player_id } — remove from watchlist
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { player_id } = await request.json()
  if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 })

  await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('player_id', player_id)

  return NextResponse.json({ ok: true })
}
