import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/pitchers/probable?date=YYYY-MM-DD
// Returns pitchers projected to start on a given date (defaults to today + tomorrow)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')

  const admin = createAdminClient()

  let query = admin
    .from('pitcher_probable_starts')
    .select('player_id, mlb_player_id, game_date, opponent, home_away, game_time')
    .order('game_date')

  if (dateParam) {
    query = query.eq('game_date', dateParam)
  } else {
    // Default: return today and tomorrow
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    query = query.gte('game_date', today).lte('game_date', tomorrow)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ starts: data ?? [] })
}

// POST /api/pitchers/probable — sync from MLB API
// Fetches probable pitchers for today + next 2 days and upserts into DB
export async function POST() {
  const admin = createAdminClient()

  const dates: string[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.now() + i * 86400000)
    dates.push(d.toISOString().split('T')[0])
  }

  const rows: any[] = []

  for (const date of dates) {
    try {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) continue
      const json = await res.json()

      const games = json.dates?.[0]?.games ?? []
      for (const game of games) {
        const gameTime = game.gameDate ?? null
        const teams = game.teams ?? {}

        for (const side of ['home', 'away'] as const) {
          const pitcher = teams[side]?.probablePitcher
          if (!pitcher) continue

          const mlbPlayerId = pitcher.id
          const opponent = side === 'home'
            ? teams.away?.team?.abbreviation
            : teams.home?.team?.abbreviation

          rows.push({
            mlb_player_id: mlbPlayerId,
            game_date: date,
            opponent: opponent ?? null,
            home_away: side,
            game_time: gameTime,
            fetched_at: new Date().toISOString(),
          })
        }
      }
    } catch {
      // continue on per-date errors
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, message: 'No probable pitchers found' })
  }

  // Match mlb_player_id → player_id in our DB
  const mlbIds = [...new Set(rows.map(r => r.mlb_player_id))]
  const { data: players } = await admin
    .from('players')
    .select('id, mlb_id')
    .in('mlb_id', mlbIds)

  const mlbToId = new Map<number, string>()
  for (const p of players ?? []) {
    if (p.mlb_id) mlbToId.set(p.mlb_id, p.id)
  }

  const rowsWithId = rows.map(r => ({
    ...r,
    player_id: mlbToId.get(r.mlb_player_id) ?? null,
  }))

  const { error } = await admin
    .from('pitcher_probable_starts')
    .upsert(rowsWithId, { onConflict: 'mlb_player_id,game_date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ synced: rowsWithId.length })
}
