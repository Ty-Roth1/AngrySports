import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/leagues/[id]/chat?before=ISO_TIMESTAMP&limit=50
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = supabase
    .from('league_chat_messages')
    .select('id, body, created_at, edited_at, deleted_at, user_id, profiles(display_name, avatar_url)')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ messages: (data ?? []).reverse() })
}

// POST /api/leagues/[id]/chat
// Body: { body: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const text = (body.body ?? '').trim()
  if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  if (text.length > 2000) return NextResponse.json({ error: 'Message too long (max 2000 chars)' }, { status: 400 })

  const { data: msg, error } = await supabase
    .from('league_chat_messages')
    .insert({ league_id: leagueId, user_id: user.id, body: text })
    .select('id, body, created_at, user_id, profiles(display_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: msg })
}

// DELETE /api/leagues/[id]/chat
// Body: { message_id }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { message_id } = body
  if (!message_id) return NextResponse.json({ error: 'message_id required' }, { status: 400 })

  // Soft delete (own messages only, enforced by RLS)
  const { error } = await supabase
    .from('league_chat_messages')
    .update({ deleted_at: new Date().toISOString(), body: '[deleted]' })
    .eq('id', message_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
