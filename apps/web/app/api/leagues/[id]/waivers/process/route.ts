import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/leagues/[id]/waivers/process
// Commissioner only. Processes all pending FAAB claims due on or before today.
// For each player, the highest bidder wins. Ties broken by waiver priority.
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
    .select('commissioner_id, season_year, is_contract_league')
    .eq('id', leagueId)
    .single()
  if (!league || league.commissioner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden — commissioner only' }, { status: 403 })
  }

  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

  // Fetch all pending claims due today or earlier
  const { data: pendingClaims } = await admin
    .from('waiver_claims')
    .select(`
      id, team_id, player_add_id, player_drop_id, bid_amount, priority,
      fantasy_teams!inner (id, faab_remaining, waiver_priority)
    `)
    .eq('league_id', leagueId)
    .eq('status', 'pending')
    .lte('process_date', today)
    .order('bid_amount', { ascending: false })

  if (!pendingClaims || pendingClaims.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No pending claims due today' })
  }

  // Group claims by player_add_id — highest bid wins (ties go to lower waiver_priority number)
  const byPlayer: Record<string, typeof pendingClaims> = {}
  for (const claim of pendingClaims) {
    if (!byPlayer[claim.player_add_id]) byPlayer[claim.player_add_id] = []
    byPlayer[claim.player_add_id].push(claim)
  }

  let won = 0
  let lost = 0

  for (const [playerId, claims] of Object.entries(byPlayer)) {
    // Sort: highest bid first, then lowest waiver priority (lower number = higher priority)
    const sorted = [...claims].sort((a, b) => {
      const bidDiff = Number(b.bid_amount) - Number(a.bid_amount)
      if (bidDiff !== 0) return bidDiff
      const aPrio = (a.fantasy_teams as any)?.waiver_priority ?? 999
      const bPrio = (b.fantasy_teams as any)?.waiver_priority ?? 999
      return aPrio - bPrio
    })

    const winner = sorted[0]
    const losers = sorted.slice(1)

    // Check winner's team has room (no limit check for now — trust commissioner)
    // Drop player if specified
    if (winner.player_drop_id) {
      await admin.from('rosters').delete()
        .eq('team_id', winner.team_id)
        .eq('player_id', winner.player_drop_id)

      // Void contract for dropped player
      await admin.from('contracts').update({ voided_at: new Date().toISOString() })
        .eq('league_id', leagueId)
        .eq('player_id', winner.player_drop_id)
        .is('voided_at', null)
    }

    // Add player to winner's roster
    await admin.from('rosters').upsert({
      team_id: winner.team_id,
      player_id: playerId,
      slot_type: 'BENCH',
      acquisition_type: 'waiver',
      acquired_at: new Date().toISOString(),
    }, { onConflict: 'team_id,player_id' })

    // Deduct FAAB from winner
    const winnerTeam = winner.fantasy_teams as any
    const newFaab = Math.max(0, Number(winnerTeam.faab_remaining) - Number(winner.bid_amount))
    await admin.from('fantasy_teams').update({ faab_remaining: newFaab }).eq('id', winner.team_id)

    // Mark winner's claim as won
    await admin.from('waiver_claims').update({ status: 'won' }).eq('id', winner.id)

    // Record transaction
    const { data: txn } = await admin.from('transactions').insert({
      league_id: leagueId,
      type: 'waiver_claim',
      status: 'completed',
      initiated_by_team_id: winner.team_id,
      notes: `FAAB: $${winner.bid_amount}`,
      processed_at: new Date().toISOString(),
    }).select('id').single()

    if (txn) {
      const items = [
        { transaction_id: txn.id, player_id: playerId, from_team_id: null, to_team_id: winner.team_id, faab_bid: winner.bid_amount },
      ]
      if (winner.player_drop_id) {
        items.push({ transaction_id: txn.id, player_id: winner.player_drop_id, from_team_id: winner.team_id, to_team_id: null, faab_bid: null })
      }
      await admin.from('transaction_items').insert(items)
    }

    won++

    // Mark all losers as lost
    for (const loser of losers) {
      await admin.from('waiver_claims').update({ status: 'lost' }).eq('id', loser.id)
      lost++
    }

    // Rotate waiver priority (winner goes to bottom)
    // Get all teams sorted by current priority
    const { data: allTeams } = await admin
      .from('fantasy_teams')
      .select('id, waiver_priority')
      .eq('league_id', leagueId)
      .order('waiver_priority')

    if (allTeams) {
      const maxPriority = Math.max(...allTeams.map(t => t.waiver_priority))
      await admin.from('fantasy_teams').update({ waiver_priority: maxPriority + 1 }).eq('id', winner.team_id)
    }
  }

  return NextResponse.json({ processed: won + lost, won, lost })
}
