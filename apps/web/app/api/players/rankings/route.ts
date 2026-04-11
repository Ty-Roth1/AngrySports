import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MLB_API = 'https://statsapi.mlb.com/api/v1'
const PITCHER_POS = new Set(['SP', 'RP'])

// Actual scoring weights used in the league
// Batting
const BAT = {
  R:    3,
  HR:   16,
  RBI:  3,
  SB:   6,
  BB:   4,
  H:    4,   // singles only
  '2B': 8,
  '3B': 12,
  SO:   -1,
  CS:   -3,
  SLAM: 20,  // grand slam (HR with 4 RBI)
}
// Pitching
const PIT = {
  W:    3,
  L:    -3,
  SV:   17.5,
  BS:   -7.5,
  HLD:  10,
  K:    2.5,
  OUTS: 1.5,  // per out recorded
  QS:   8,
  ER:   -3,
  BB:   -0.5,
}

function computeBatting(s: any): number {
  const hits    = s.hits       ?? 0
  const doubles = s.doubles    ?? 0
  const triples = s.triples    ?? 0
  const hrs     = s.homeRuns   ?? 0
  const singles = Math.max(0, hits - doubles - triples - hrs)
  return (
    singles          * BAT.H    +
    doubles          * BAT['2B'] +
    triples          * BAT['3B'] +
    hrs              * BAT.HR   +
    (s.runs          ?? 0) * BAT.R   +
    (s.rbi           ?? 0) * BAT.RBI +
    (s.stolenBases   ?? 0) * BAT.SB  +
    (s.baseOnBalls   ?? 0) * BAT.BB  +
    (s.strikeOuts    ?? 0) * BAT.SO  +
    (s.caughtStealing ?? 0) * BAT.CS
  )
}

function computePitching(s: any): number {
  const ipParts = String(s.inningsPitched ?? '0.0').split('.')
  const wholeInnings = parseInt(ipParts[0] ?? '0') || 0
  const partOuts     = parseInt(ipParts[1] ?? '0') || 0
  const totalOuts    = wholeInnings * 3 + partOuts
  const ip           = wholeInnings + partOuts / 3

  // Quality start: 6+ IP and 3 or fewer earned runs
  const er = s.earnedRuns ?? 0
  const qs = ip >= 6 && er <= 3 ? 1 : 0

  return (
    (s.wins         ?? 0) * PIT.W    +
    (s.losses       ?? 0) * PIT.L    +
    (s.saves        ?? 0) * PIT.SV   +
    (s.blownSaves   ?? s.blownSave ?? 0) * PIT.BS  +
    (s.holds        ?? s.hold ?? 0) * PIT.HLD  +
    (s.strikeOuts   ?? 0) * PIT.K    +
    totalOuts              * PIT.OUTS +
    qs                     * PIT.QS   +
    er                     * PIT.ER   +
    (s.baseOnBalls  ?? 0) * PIT.BB
  )
}

// POST /api/players/rankings
// Computes season_pts, rank (OVR within type), and position_rank for all players.
// Hitters are ranked among hitters; pitchers among pitchers.
// Covers all players including free agents via MLB API season stats.
export async function POST(_request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const season = new Date().getFullYear()

  try {
    // Fetch season batting + pitching splits in parallel
    const [battingRes, pitchingRes] = await Promise.all([
      fetch(`${MLB_API}/stats?stats=season&group=hitting&season=${season}&sportId=1&limit=1000&gameType=R`, { next: { revalidate: 3600 } }),
      fetch(`${MLB_API}/stats?stats=season&group=pitching&season=${season}&sportId=1&limit=1000&gameType=R`, { next: { revalidate: 3600 } }),
    ])
    const battingJson  = battingRes.ok  ? await battingRes.json()  : { stats: [] }
    const pitchingJson = pitchingRes.ok ? await pitchingRes.json() : { stats: [] }

    // mlb_id → computed season points
    const mlbPts: Record<number, number> = {}

    for (const split of battingJson.stats?.[0]?.splits ?? []) {
      const mlbId: number = split.player?.id
      if (!mlbId) continue
      mlbPts[mlbId] = (mlbPts[mlbId] ?? 0) + computeBatting(split.stat ?? {})
    }
    for (const split of pitchingJson.stats?.[0]?.splits ?? []) {
      const mlbId: number = split.player?.id
      if (!mlbId) continue
      mlbPts[mlbId] = (mlbPts[mlbId] ?? 0) + computePitching(split.stat ?? {})
    }

    // Fetch primary_position for all players in our DB who have MLB ids
    const admin = createAdminClient()
    const mlbIds = Object.keys(mlbPts).map(Number)

    const { data: dbPlayers } = await admin
      .from('players')
      .select('id, mlb_id, primary_position')
      .in('mlb_id', mlbIds)

    if (!dbPlayers || dbPlayers.length === 0) {
      return NextResponse.json({ ranked: 0, season, note: 'No players matched — run player sync first' })
    }

    // Build lookup: mlb_id → { id, primary_position }
    const byMlbId: Record<number, { id: string; primary_position: string }> = {}
    for (const p of dbPlayers) byMlbId[p.mlb_id] = { id: p.id, primary_position: p.primary_position }

    // Separate into hitters and pitchers, keeping only positive scorers
    type Entry = { mlb_id: number; pts: number; pos: string }
    const hitters:  Entry[] = []
    const pitchers: Entry[] = []

    for (const [mlbIdStr, pts] of Object.entries(mlbPts)) {
      const mlbId = Number(mlbIdStr)
      const dbP   = byMlbId[mlbId]
      if (!dbP || pts <= 0) continue
      const entry = { mlb_id: mlbId, pts, pos: dbP.primary_position }
      if (PITCHER_POS.has(dbP.primary_position)) pitchers.push(entry)
      else hitters.push(entry)
    }

    hitters.sort((a, b)  => b.pts - a.pts)
    pitchers.sort((a, b) => b.pts - a.pts)

    // Position rank within hitters only
    const byPos: Record<string, Entry[]> = {}
    for (const h of hitters) {
      if (!byPos[h.pos]) byPos[h.pos] = []
      byPos[h.pos].push(h)
    }
    // Each position list is already in descending pts order

    // Build update payload — keyed by UUID (primary key) so the operation is
    // always an UPDATE, never an INSERT (avoids not-null constraint on full_name).
    type RankRow = { id: string; rank: number; position_rank: number | null; season_pts: number; updated_at: string }
    const updates: RankRow[] = []
    const now = new Date().toISOString()

    hitters.forEach((h, i) => {
      const dbP = byMlbId[h.mlb_id]
      if (!dbP) return
      const posArr  = byPos[h.pos] ?? []
      const posRank = posArr.findIndex(p => p.mlb_id === h.mlb_id) + 1
      updates.push({ id: dbP.id, rank: i + 1, position_rank: posRank || null, season_pts: Math.round(h.pts * 10) / 10, updated_at: now })
    })
    pitchers.forEach((p, i) => {
      const dbP = byMlbId[p.mlb_id]
      if (!dbP) return
      updates.push({ id: dbP.id, rank: i + 1, position_rank: null, season_pts: Math.round(p.pts * 10) / 10, updated_at: now })
    })

    // Update in parallel batches of 50 — plain UPDATE by UUID, never an INSERT
    const PARALLEL = 50
    let total = 0
    for (let i = 0; i < updates.length; i += PARALLEL) {
      const batch = updates.slice(i, i + PARALLEL)
      const results = await Promise.all(
        batch.map(row =>
          admin.from('players')
            .update({ rank: row.rank, position_rank: row.position_rank, season_pts: row.season_pts, updated_at: row.updated_at })
            .eq('id', row.id)
        )
      )
      const err = results.find(r => r.error)?.error
      if (err) return NextResponse.json({ error: err.message }, { status: 500 })
      total += batch.length
    }

    // Clear stale ranks for players not in this run
    const rankedIds = updates.map(u => u.id)
    if (rankedIds.length > 0) {
      await admin
        .from('players')
        .update({ rank: null, position_rank: null, season_pts: null })
        .not('id', 'in', `(${rankedIds.join(',')})`)
        .not('rank', 'is', null)
    }

    return NextResponse.json({ ranked: total, hitters: hitters.length, pitchers: pitchers.length, season })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
