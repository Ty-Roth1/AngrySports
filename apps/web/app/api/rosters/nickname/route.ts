import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/rosters/nickname
// Body: { roster_id: string, nickname: string }
// Only the team owner can set a nickname for a player on their roster.
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roster_id, nickname } = await req.json()
  if (!roster_id) return NextResponse.json({ error: 'roster_id required' }, { status: 400 })

  // Verify the roster entry belongs to a team owned by this user
  const { data: roster } = await supabase
    .from('rosters')
    .select('id, fantasy_teams(owner_id)')
    .eq('id', roster_id)
    .single()

  if (!roster) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((roster.fantasy_teams as any)?.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const trimmed = nickname?.trim() ?? ''
  const { error } = await supabase
    .from('rosters')
    .update({ nickname: trimmed || null })
    .eq('id', roster_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nickname: trimmed || null })
}
