import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MLB_API = 'https://statsapi.mlb.com/api/v1'

// POST /api/players/rankings
// Syncs player season stats from MLB API and computes a fantasy rank.
// Rank is based on a weighted fantasy value score: lower rank = better player.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const season = new Date().getFullYear()

  try {
    // Fetch season batting leaders
    const battingRes = await fetch(
      `${MLB_API}/stats?stats=season&group=hitting&season=${season}&sportId=1&limit=500&gameType=R`,
      { next: { revalidate: 3600 } }
    )
    const battingJson = battingRes.ok ? await battingRes.json() : { stats: [] }
    const battingSplits: any[] = battingJson.stats?.[0]?.splits ?? []

    // Fetch season pitching leaders
    const pitchingRes = await fetch(
      `${MLB_API}/stats?stats=season&group=pitching&season=${season}&sportId=1&limit=500&gameType=R`,
      { next: { revalidate: 3600 } }
    )
    const pitchingJson = pitchingRes.ok ? await pitchingRes.json() : { stats: [] }
    const pitchingSplits: any[] = pitchingJson.stats?.[0]?.splits ?? []

    // Compute fantasy value score for each player
    // Batters: 3×HR + 1.5×RBI + 1×R + 2×SB + 0.3×H + 1×BB
    // Pitchers: 5×W + 1×K + 4×SV + 3×HLD + 0.3×IP - 2×ER
    type PlayerScore = { mlb_id: number; score: number }
    const scores: Record<number, PlayerScore> = {}

    for (const split of battingSplits) {
      const mlbId: number = split.player?.id
      if (!mlbId) continue
      const s = split.stat ?? {}
      const score =
        (s.homeRuns ?? 0) * 3 +
        (s.rbi ?? 0) * 1.5 +
        (s.runs ?? 0) * 1 +
        (s.stolenBases ?? 0) * 2 +
        (s.hits ?? 0) * 0.3 +
        (s.baseOnBalls ?? 0) * 1
      scores[mlbId] = { mlb_id: mlbId, score: (scores[mlbId]?.score ?? 0) + score }
    }

    for (const split of pitchingSplits) {
      const mlbId: number = split.player?.id
      if (!mlbId) continue
      const s = split.stat ?? {}
      const ipParts = String(s.inningsPitched ?? '0.0').split('.')
      const ip = parseInt(ipParts[0] ?? '0') + (parseInt(ipParts[1] ?? '0') / 3)
      const score =
        (s.wins ?? 0) * 5 +
        (s.strikeOuts ?? 0) * 1 +
        (s.saves ?? 0) * 4 +
        (s.holds ?? 0) * 3 +
        ip * 0.3 -
        (s.earnedRuns ?? 0) * 2
      scores[mlbId] = { mlb_id: mlbId, score: (scores[mlbId]?.score ?? 0) + score }
    }

    // Sort by score descending, assign rank 1..N
    const ranked = Object.values(scores)
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)

    const admin = createAdminClient()

    // Upsert ranks in batches
    const BATCH = 200
    let total = 0
    for (let i = 0; i < ranked.length; i += BATCH) {
      const batch = ranked.slice(i, i + BATCH).map((p, j) => ({
        mlb_id: p.mlb_id,
        rank: i + j + 1,
        updated_at: new Date().toISOString(),
      }))
      await admin.from('players').upsert(batch, { onConflict: 'mlb_id' })
      total += batch.length
    }

    // Clear rank for any players not in top 500
    // (players with no stats this season or unranked)
    const rankedIds = ranked.map(p => p.mlb_id)
    if (rankedIds.length > 0) {
      await admin
        .from('players')
        .update({ rank: null })
        .not('mlb_id', 'in', `(${rankedIds.join(',')})`)
        .not('rank', 'is', null)
    }

    return NextResponse.json({ ranked: total, season })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
