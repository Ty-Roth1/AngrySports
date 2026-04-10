import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// PATCH /api/leagues/[id]/settings
// Commissioner only. Updates league and/or league_settings fields.
// Body: { co_commissioner_email?, league_name?, trade_deadline_week?, waiver_type?, faab_budget? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leagueId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: league } = await supabase
    .from('leagues')
    .select('commissioner_id')
    .eq('id', leagueId)
    .single()
  if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })
  if (league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Commissioner only' }, { status: 403 })
  }

  const body = await request.json()
  const {
    co_commissioner_email, league_name, trade_deadline_week, waiver_type, faab_budget,
    spots_c, spots_1b, spots_2b, spots_3b, spots_ss, spots_if, spots_of,
    spots_util, spots_sp, spots_rp, spots_p, spots_bench, spots_il,
  } = body

  const admin = createAdminClient()

  // Resolve co-commissioner email → user id
  if (co_commissioner_email !== undefined) {
    if (co_commissioner_email === null || co_commissioner_email === '') {
      // Remove co-commissioner
      await admin.from('leagues').update({ co_commissioner_id: null }).eq('id', leagueId)
    } else {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('email', co_commissioner_email.trim().toLowerCase())
        .maybeSingle()

      if (!profile) {
        return NextResponse.json({ error: `No account found for ${co_commissioner_email}` }, { status: 404 })
      }
      await admin.from('leagues').update({ co_commissioner_id: profile.id }).eq('id', leagueId)
    }
  }

  // Update league name
  if (league_name) {
    const { error } = await admin
      .from('leagues')
      .update({ name: league_name.trim() })
      .eq('id', leagueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update league_settings fields
  const settingsUpdate: Record<string, any> = {}
  if (trade_deadline_week !== undefined) settingsUpdate.trade_deadline_week = trade_deadline_week
  if (waiver_type !== undefined) settingsUpdate.waiver_type = waiver_type
  if (faab_budget !== undefined) settingsUpdate.faab_budget = faab_budget
  if (spots_c     !== undefined) settingsUpdate.spots_c     = spots_c
  if (spots_1b    !== undefined) settingsUpdate.spots_1b    = spots_1b
  if (spots_2b    !== undefined) settingsUpdate.spots_2b    = spots_2b
  if (spots_3b    !== undefined) settingsUpdate.spots_3b    = spots_3b
  if (spots_ss    !== undefined) settingsUpdate.spots_ss    = spots_ss
  if (spots_if    !== undefined) settingsUpdate.spots_if    = spots_if
  if (spots_of    !== undefined) settingsUpdate.spots_of    = spots_of
  if (spots_util  !== undefined) settingsUpdate.spots_util  = spots_util
  if (spots_sp    !== undefined) settingsUpdate.spots_sp    = spots_sp
  if (spots_rp    !== undefined) settingsUpdate.spots_rp    = spots_rp
  if (spots_p     !== undefined) settingsUpdate.spots_p     = spots_p
  if (spots_bench !== undefined) settingsUpdate.spots_bench = spots_bench
  if (spots_il    !== undefined) settingsUpdate.spots_il    = spots_il

  if (Object.keys(settingsUpdate).length > 0) {
    const { error } = await admin
      .from('league_settings')
      .update(settingsUpdate)
      .eq('league_id', leagueId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
