import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MLB_API = 'https://statsapi.mlb.com/api/v1'

// POST /api/players/rankings
// Computes fantasy rank (OVR) and position_rank for all players using
// season stats from the MLB API. Ranking formula mirrors actual scoring weights.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const season = new Date().getFullYear()

  try {
    // Fetch season batting + pitching leaders in parallel
    const [battingRes, pitchingRes] = await Promise.all([
      fetch(`${MLB_API}/stats?stats=season&group=hitting&season=${season}&sportId=1&limit=600&gameType=R`, { next: { revalidate: 3600 } }),
      fetch(`${MLB_API}/stats?stats=season&group=pitching&season=${season}&sportId=1&limit=600&gameType=R`, { next: { revalidate: 3600 } }),
    ])
    const battingJson  = battingRes.ok  ? await battingRes.json()  : { stats: [] }
    const pitchingJson = pitchingRes.ok ? await pitchingRes.json() : { stats: [] }
    const battingSplits:  any[] = battingJson.stats?.[0]?.splits  ?? []
    const pitchingSplits: any[] = pitchingJson.stats?.[0]?.splits ?? []

    // Compute a fantasy value score per player.
    // Weights are calibrated to match typical points-league scoring:
    //   Batters:  HR×4, RBI×1, R×1, SB×2, 1B×1, 2B×1.5, 3B×2, BB×1, SO×-0.5
    //   Pitchers: W×5, K×1, SV×5, HLD×3, IP×1, ER×-2, BB×-0.5
    type PlayerScore = { mlb_id: number; score: number }
    const scores: Record<number, PlayerScore> = {}

    for (const split of battingSplits) {
      const mlbId: number = split.player?.id
      if (!mlbId) continue
      const s = split.stat ?? {}
      const hits    = s.hits ?? 0
      const doubles = s.doubles ?? 0
      const triples = s.triples ?? 0
      const hrs     = s.homeRuns ?? 0
      const singles = Math.max(0, hits - doubles - triples - hrs)
      const score =
        singles  * 1   +
        doubles  * 1.5 +
        triples  * 2   +
        hrs      * 4   +
        (s.rbi          ?? 0) * 1    +
        (s.runs         ?? 0) * 1    +
        (s.stolenBases  ?? 0) * 2    +
        (s.baseOnBalls  ?? 0) * 1    +
        (s.strikeOuts   ?? 0) * -0.5
      scores[mlbId] = { mlb_id: mlbId, score: (scores[mlbId]?.score ?? 0) + score }
    }

    for (const split of pitchingSplits) {
      const mlbId: number = split.player?.id
      if (!mlbId) continue
      const s = split.stat ?? {}
      const ipParts = String(s.inningsPitched ?? '0.0').split('.')
      const ip = parseInt(ipParts[0] ?? '0') + (parseInt(ipParts[1] ?? '0') / 3)
      const score =
        (s.wins        ?? 0) * 5    +
        (s.strikeOuts  ?? 0) * 1    +
        (s.saves       ?? 0) * 5    +
        (s.holds       ?? 0) * 3    +
        ip                   * 1    +
        (s.earnedRuns  ?? 0) * -2   +
        (s.baseOnBalls ?? 0) * -0.5
      scores[mlbId] = { mlb_id: mlbId, score: (scores[mlbId]?.score ?? 0) + score }
    }

    // Sort descending by score → OVR rank
    const ranked = Object.values(scores)
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)

    // Build mlb_id → OVR rank map
    const ovrRank: Record<number, number> = {}
    ranked.forEach((p, i) => { ovrRank[p.mlb_id] = i + 1 })

    // Fetch primary_position for all ranked players from our DB
    const admin = createAdminClient()
    const rankedMlbIds = ranked.map(p => p.mlb_id)

    const { data: dbPlayers } = await admin
      .from('players')
      .select('mlb_id, primary_position')
      .in('mlb_id', rankedMlbIds)

    // Group mlb_ids by primary_position, keeping score order (already sorted)
    const byPosition: Record<string, number[]> = {}
    for (const dbP of dbPlayers ?? []) {
      const pos = dbP.primary_position ?? 'OF'
      if (!byPosition[pos]) byPosition[pos] = []
      byPosition[pos].push(dbP.mlb_id)
    }

    // Build mlb_id → position_rank (1-based within position)
    // Each position list is already in descending score order because we
    // added mlb_ids in ranked order above.
    const posRank: Record<number, number> = {}
    for (const ids of Object.values(byPosition)) {
      ids.forEach((mlbId, i) => { posRank[mlbId] = i + 1 })
    }

    // Upsert both ranks in batches of 200
    const BATCH = 200
    let total = 0
    for (let i = 0; i < ranked.length; i += BATCH) {
      const batch = ranked.slice(i, i + BATCH).map(p => ({
        mlb_id:        p.mlb_id,
        rank:          ovrRank[p.mlb_id],
        position_rank: posRank[p.mlb_id] ?? null,
        updated_at:    new Date().toISOString(),
      }))
      await admin.from('players').upsert(batch, { onConflict: 'mlb_id' })
      total += batch.length
    }

    // Clear rank for any players who had a rank but are no longer in the top results
    if (rankedMlbIds.length > 0) {
      await admin
        .from('players')
        .update({ rank: null, position_rank: null })
        .not('mlb_id', 'in', `(${rankedMlbIds.join(',')})`)
        .not('rank', 'is', null)
    }

    return NextResponse.json({ ranked: total, season })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
