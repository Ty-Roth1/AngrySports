import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// PATCH /api/leagues/[id]/contracts/[contractId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const { id: leagueId, contractId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch contract — use admin so RLS doesn't block the lookup
  const { data: contract } = await admin
    .from('contracts')
    .select('id, league_id, team_id')
    .eq('id', contractId)
    .eq('league_id', leagueId)
    .is('voided_at', null)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  // Auth: team owner or commissioner
  const { data: team } = await admin
    .from('fantasy_teams')
    .select('owner_id')
    .eq('id', contract.team_id)
    .single()

  if (team?.owner_id !== user.id) {
    const { data: league } = await admin
      .from('leagues')
      .select('commissioner_id, co_commissioner_id')
      .eq('id', leagueId)
      .single()
    const isCommish = league?.commissioner_id === user.id || league?.co_commissioner_id === user.id
    if (!isCommish) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const patch: Record<string, any> = {}
  if (body.salary !== undefined)               patch.salary = Number(body.salary)
  if (body.years_total !== undefined)          patch.years_total = Number(body.years_total)
  if (body.years_remaining !== undefined)      patch.years_remaining = Number(body.years_remaining)
  if (body.expires_after_season !== undefined) patch.expires_after_season = Number(body.expires_after_season)
  if (body.contract_type !== undefined)        patch.contract_type = body.contract_type

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await admin.from('contracts').update(patch).eq('id', contractId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
