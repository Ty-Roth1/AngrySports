import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MLB_API = 'https://statsapi.mlb.com/api/v1'

// Maps MLB position abbreviations to our normalized position keys
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
// Fetches fielding stats from MLB API for current + previous season,
// then updates eligible_positions for all players in our DB.
// Commissioner-only (must be logged in as commissioner of any league).
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the caller is a commissioner of at least one league
  const { data: commishCheck } = await supabase
    .from('leagues')
    .select('id')
    .or(`commissioner_id.eq.${user.id},co_commissioner_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()
  if (!commishCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const season = new Date().getFullYear()

  // Build mlbId → Set<position> from fielding stats
  const posMap = new Map<number, Set<string>>()

  function addPos(mlbId: number, pos: string | undefined) {
    const mapped = mapPos(pos)
    if (!mapped) return
    if (!posMap.has(mlbId)) posMap.set(mlbId, new Set())
    posMap.get(mlbId)!.add(mapped)
    // pitchers always get both
    if (mapped === 'SP' || mapped === 'RP') {
      posMap.get(mlbId)!.add('SP')
      posMap.get(mlbId)!.add('RP')
    }
  }

  // Fetch fielding stats for current + previous season from the bulk stats endpoint
  for (const yr of [season, season - 1]) {
    try {
      const res = await fetch(
        `${MLB_API}/stats?stats=season&group=fielding&season=${yr}&sportId=1&gameType=R&limit=5000`,
        { next: { revalidate: 0 } }
      )
      if (!res.ok) continue
      const json = await res.json()

      for (const stat of json.stats ?? []) {
        for (const split of stat.splits ?? []) {
          const mlbId: number = split.player?.id
          const pos: string = split.position?.abbreviation ?? split.position?.name
          if (mlbId && pos) addPos(mlbId, pos)
        }
      }
    } catch {
      // continue on error
    }
  }

  // Also fetch all 30 team rosters for the current season (picks up allPositions on player objects)
  try {
    const teamsRes = await fetch(`${MLB_API}/teams?sportId=1&season=${season}`, { next: { revalidate: 3600 } })
    if (teamsRes.ok) {
      const teamsJson = await teamsRes.json()
      const teamIds: number[] = (teamsJson.teams ?? []).map((t: any) => t.id)

      await Promise.all(teamIds.map(async (teamId) => {
        try {
          const rRes = await fetch(
            `${MLB_API}/teams/${teamId}/roster/Active?season=${season}&hydrate=person(allPositions)`,
            { next: { revalidate: 3600 } }
          )
          if (!rRes.ok) return
          const rJson = await rRes.json()
          for (const entry of rJson.roster ?? []) {
            const mlbId: number = entry.person?.id
            if (!mlbId) continue
            // primary position
            addPos(mlbId, entry.position?.abbreviation ?? entry.position?.name)
            // allPositions on person (if hydrated)
            for (const pos of entry.person?.allPositions ?? []) {
              addPos(mlbId, pos.abbreviation ?? pos.name)
            }
          }
        } catch { /* skip team on error */ }
      }))
    }
  } catch { /* skip */ }

  if (posMap.size === 0) {
    return NextResponse.json({ error: 'No position data retrieved from MLB API' }, { status: 500 })
  }

  // Pull all players from our DB and update eligible_positions
  const { data: dbPlayers } = await admin
    .from('players')
    .select('id, mlb_id, primary_position, eligible_positions')

  const updates: { id: string; eligible_positions: string[] }[] = []

  for (const p of dbPlayers ?? []) {
    const positions = posMap.get(p.mlb_id)
    if (!positions || positions.size === 0) continue

    // Always include primary position
    positions.add(p.primary_position)
    if (p.primary_position === 'SP' || p.primary_position === 'RP') {
      positions.add('SP')
      positions.add('RP')
    }

    const newPositions = Array.from(positions).sort()
    const existing = [...(p.eligible_positions ?? [])].sort()

    // Only update if positions changed
    if (JSON.stringify(newPositions) !== JSON.stringify(existing)) {
      updates.push({ id: p.id, eligible_positions: newPositions })
    }
  }

  // Batch upsert
  const BATCH = 500
  let total = 0
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    await admin.from('players').upsert(batch, { onConflict: 'id' })
    total += batch.length
  }

  return NextResponse.json({ updated: total, playersWithMultiplePositions: updates.filter(u => u.eligible_positions.length > 1).length })
}
