import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/leagues/[id]/transactions?limit=50&offset=0
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100)
  const offset = Number(url.searchParams.get('offset') ?? 0)

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      id, type, status, notes, created_at, processed_at,
      initiated_by_team:initiated_by_team_id (name, abbreviation),
      transaction_items (
        player_id, faab_bid,
        from_team:from_team_id (name, abbreviation),
        to_team:to_team_id (name, abbreviation),
        players (full_name, primary_position)
      )
    `)
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ transactions })
}
