import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/chat/reactions — toggle a reaction
// Body: { message_id, emoji }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { message_id, emoji } = body
  if (!message_id || !emoji) return NextResponse.json({ error: 'message_id and emoji required' }, { status: 400 })

  // Check if reaction already exists (toggle)
  const { data: existing } = await supabase
    .from('league_chat_reactions')
    .select('id')
    .eq('message_id', message_id)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await supabase.from('league_chat_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ action: 'removed' })
  } else {
    await supabase.from('league_chat_reactions').insert({ message_id, user_id: user.id, emoji })
    return NextResponse.json({ action: 'added' })
  }
}

// GET /api/leagues/[id]/chat/reactions?message_ids=id1,id2
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('message_ids') ?? '').split(',').filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ reactions: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('league_chat_reactions')
    .select('id, message_id, user_id, emoji')
    .in('message_id', ids)

  return NextResponse.json({ reactions: data ?? [] })
}
