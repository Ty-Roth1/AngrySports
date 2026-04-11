import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const MLB_API = 'https://statsapi.mlb.com/api/v1'

// Maps MLB position codes to our position types
const POSITION_MAP: Record<string, string> = {
  'C': 'C', 'First Base': '1B', '1B': '1B',
  'Second Base': '2B', '2B': '2B',
  'Third Base': '3B', '3B': '3B',
  'Shortstop': 'SS', 'SS': 'SS',
  'Outfield': 'OF', 'OF': 'OF',
  'Left Field': 'OF', 'Center Field': 'OF', 'Right Field': 'OF',
  'Designated Hitter': 'DH', 'DH': 'DH',
  'Starting Pitcher': 'SP', 'SP': 'SP', 'Pitcher': 'SP', 'P': 'SP',
  'Relief Pitcher': 'RP', 'RP': 'RP',
}

function mapPosition(pos: string): string {
  return POSITION_MAP[pos] ?? 'OF'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const season = new Date().getFullYear()

  try {
    // Fetch team abbreviations first (id → abbreviation map)
    const teamsRes = await fetch(`${MLB_API}/teams?sportId=1&season=${season}`, { next: { revalidate: 3600 } })
    const teamsJson = teamsRes.ok ? await teamsRes.json() : { teams: [] }
    const teamAbbrMap: Record<number, string> = {}
    for (const t of teamsJson.teams ?? []) {
      if (t.id && t.abbreviation) teamAbbrMap[t.id] = t.abbreviation
    }

    // Fetch all players on 40-man rosters + active rosters for the current season
    const response = await fetch(
      `${MLB_API}/sports/1/players?season=${season}&gameType=R`,
      { next: { revalidate: 0 } }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'MLB API error' }, { status: 502 })
    }

    const json = await response.json()
    const mlbPlayers: any[] = json.people ?? []

    // Also fetch minor league players for taxi squad eligibility
    const minorResponse = await fetch(
      `${MLB_API}/sports/11/players?season=${season}`,
      { next: { revalidate: 0 } }
    )
    const minorJson = minorResponse.ok ? await minorResponse.json() : { people: [] }
    const minorPlayers: any[] = (minorJson.people ?? []).map((p: any) => ({ ...p, _isMinor: true }))

    const allPlayers = [...mlbPlayers, ...minorPlayers]

    // Fetch previous season's players to capture positions played last year
    const prevSeason = season - 1
    const prevResponse = await fetch(
      `${MLB_API}/sports/1/players?season=${prevSeason}&gameType=R`,
      { next: { revalidate: 3600 } }
    )
    const prevJson = prevResponse.ok ? await prevResponse.json() : { people: [] }
    // Build a map of mlbId → positions played last year
    const prevPositions = new Map<number, Set<string>>()
    for (const p of prevJson.people ?? []) {
      const s = new Set<string>()
      for (const pos of p.allPositions ?? []) {
        const mapped = mapPosition(pos.abbreviation ?? pos.code ?? '')
        if (mapped) s.add(mapped)
      }
      const primary = mapPosition(p.primaryPosition?.abbreviation ?? p.primaryPosition?.name ?? '')
      if (primary) s.add(primary)
      if (s.size > 0) prevPositions.set(p.id, s)
    }

    const upserts = allPlayers.map((p: any) => {
      const primaryPos = mapPosition(
        p.primaryPosition?.abbreviation ?? p.primaryPosition?.name ?? 'OF'
      )
      const eligible = new Set<string>([primaryPos])
      // Outfield sub-positions → OF
      if (['LF', 'CF', 'RF', 'OF'].includes(p.primaryPosition?.abbreviation)) eligible.add('OF')

      // Add positions from allPositions (current season, if API returns them)
      for (const pos of p.allPositions ?? []) {
        const mapped = mapPosition(pos.abbreviation ?? pos.code ?? '')
        if (mapped) eligible.add(mapped)
        if (['LF', 'CF', 'RF'].includes(pos.abbreviation ?? '')) eligible.add('OF')
      }

      // Add positions from previous season
      for (const pos of prevPositions.get(p.id) ?? []) {
        eligible.add(pos)
      }

      // Pitchers: if eligible for SP or RP, eligible for both
      if (eligible.has('SP') || eligible.has('RP')) { eligible.add('SP'); eligible.add('RP') }

      const debutYear = p.mlbDebutDate ? parseInt(p.mlbDebutDate.split('-')[0]) : null
      // Rookie = debuted THIS season. Second-year = debuted LAST season.
      const isRookie     = debutYear === season
      const isSecondYear = debutYear === season - 1

      const teamId = p.currentTeam?.id ?? null
      const teamAbbr = teamId ? (teamAbbrMap[teamId] ?? null) : null

      return {
        mlb_id: p.id,
        full_name: p.fullName,
        first_name: p.firstName ?? '',
        last_name: p.lastName ?? '',
        primary_position: primaryPos,
        eligible_positions: Array.from(eligible),
        mlb_team: teamAbbr,          // now stores "SEA" not "Seattle Mariners"
        mlb_team_id: teamId,
        jersey_number: p.primaryNumber ?? null,
        bats: ['L', 'R', 'S'].includes(p.batSide?.code) ? p.batSide.code : null,
        throws: ['L', 'R'].includes(p.pitchHand?.code) ? p.pitchHand.code : null,
        birth_date: p.birthDate ?? null,
        status: p._isMinor ? 'minors' : (p.active ? 'active' : 'inactive'),
        is_rookie: isRookie,
        is_second_year: isSecondYear,
        pro_debut_year: debutYear,
        photo_url: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`,
        updated_at: new Date().toISOString(),
      }
    })

    // Use admin client to bypass RLS for bulk upsert
    const adminSupabase = createAdminClient()

    // Upsert in batches of 500 to avoid request size limits
    const BATCH = 500
    let total = 0
    for (let i = 0; i < upserts.length; i += BATCH) {
      const batch = upserts.slice(i, i + BATCH)
      const { error } = await adminSupabase
        .from('players')
        .upsert(batch, { onConflict: 'mlb_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      total += batch.length
    }

    return NextResponse.json({ synced: total, season })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
