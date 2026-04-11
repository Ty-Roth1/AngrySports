import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MLB_API = 'https://statsapi.mlb.com/api/v1'

const POSITION_MAP: Record<string, string> = {
  'C': 'C',
  '1B': '1B', 'First Base': '1B',
  '2B': '2B', 'Second Base': '2B',
  '3B': '3B', 'Third Base': '3B',
  'SS': 'SS', 'Shortstop': 'SS',
  'LF': 'OF', 'CF': 'OF', 'RF': 'OF', 'OF': 'OF', 'Outfield': 'OF',
  'Left Field': 'OF', 'Center Field': 'OF', 'Right Field': 'OF',
  'DH': 'DH', 'Designated Hitter': 'DH',
  'SP': 'SP', 'P': 'SP', 'Pitcher': 'SP', 'Starting Pitcher': 'SP',
  'RP': 'RP', 'Relief Pitcher': 'RP',
}

function mapPos(s: string | undefined): string | null {
  if (!s) return null
  return POSITION_MAP[s] ?? null
}

// POST /api/players/positions/sync
// Fetches fielding stats for every player in our DB via batched MLB people API
// calls (100 IDs per request), then updates eligible_positions.
// Commissioner-only.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: commishCheck } = await supabase
    .from('leagues')
    .select('id')
    .or(`commissioner_id.eq.${user.id},co_commissioner_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()
  if (!commishCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const season = new Date().getFullYear()

  // Fetch all players from our DB
  const { data: dbPlayers } = await admin
    .from('players')
    .select('id, mlb_id, primary_position, eligible_positions')

  if (!dbPlayers || dbPlayers.length === 0) {
    return NextResponse.json({ error: 'No players in DB' }, { status: 500 })
  }

  // Build mlbId → Set<position> by calling people?personIds in batches of 100
  const posMap = new Map<number, Set<string>>()

  function addPos(mlbId: number, pos: string | undefined) {
    const mapped = mapPos(pos)
    if (!mapped) return
    if (!posMap.has(mlbId)) posMap.set(mlbId, new Set())
    posMap.get(mlbId)!.add(mapped)
    if (mapped === 'SP' || mapped === 'RP') {
      posMap.get(mlbId)!.add('SP')
      posMap.get(mlbId)!.add('RP')
    }
  }

  const mlbIds = dbPlayers.map(p => p.mlb_id).filter(Boolean)
  const BATCH = 100

  // Fetch fielding stats for current season and previous season
  for (const yr of [season, season - 1]) {
    const batches: number[][] = []
    for (let i = 0; i < mlbIds.length; i += BATCH) {
      batches.push(mlbIds.slice(i, i + BATCH))
    }

    // Run up to 10 batches in parallel at a time to avoid overwhelming the API
    const CONCURRENCY = 10
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY)
      await Promise.all(chunk.map(async (ids) => {
        try {
          const url = `${MLB_API}/people?personIds=${ids.join(',')}&hydrate=stats(group=fielding,type=season,season=${yr})`
          const res = await fetch(url, { next: { revalidate: 0 } })
          if (!res.ok) return
          const json = await res.json()

          for (const person of json.people ?? []) {
            const mlbId: number = person.id
            if (!mlbId) continue

            // Always capture primary position
            addPos(mlbId, person.primaryPosition?.abbreviation ?? person.primaryPosition?.name)

            // Parse fielding stats splits for positions actually played
            for (const statGroup of person.stats ?? []) {
              if (statGroup.group?.displayName !== 'fielding') continue
              for (const split of statGroup.splits ?? []) {
                addPos(mlbId, split.position?.abbreviation ?? split.position?.name)
              }
            }
          }
        } catch { /* skip batch on error */ }
      }))
    }
  }

  if (posMap.size === 0) {
    return NextResponse.json({ error: 'No position data retrieved from MLB API' }, { status: 500 })
  }

  // Build update list — only update players whose eligible_positions changed
  const updates: { id: string; eligible_positions: string[] }[] = []

  for (const p of dbPlayers) {
    const positions = posMap.get(p.mlb_id)

    // Start from existing eligible_positions, fall back to primary_position
    const base = new Set<string>(
      positions ?? [p.primary_position]
    )
    // Always ensure primary position is included
    base.add(p.primary_position)
    if (p.primary_position === 'SP' || p.primary_position === 'RP') {
      base.add('SP'); base.add('RP')
    }

    const newPositions = Array.from(base).sort()
    const existing = [...(p.eligible_positions ?? [])].sort()

    if (JSON.stringify(newPositions) !== JSON.stringify(existing)) {
      updates.push({ id: p.id, eligible_positions: newPositions })
    }
  }

  // Update in parallel batches — using individual updates since Supabase
  // doesn't support bulk multi-row updates natively
  const CONCURRENCY = 20
  let total = 0
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(u =>
        admin
          .from('players')
          .update({ eligible_positions: u.eligible_positions })
          .eq('id', u.id)
      )
    )
    total += results.filter(r => !r.error).length
  }

  return NextResponse.json({
    updated: total,
    playersWithMultiplePositions: updates.filter(u => u.eligible_positions.length > 1).length,
  })
}
