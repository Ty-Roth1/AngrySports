const MLB_API = 'https://statsapi.mlb.com/api/v1'

export interface MlbStatLine {
  season: string
  team: string
  teamId: number
  // Batting
  avg?: number
  obp?: number
  slg?: number
  ops?: number
  ab?: number
  hits?: number
  doubles?: number
  triples?: number
  homeRuns?: number
  rbi?: number
  runs?: number
  stolenBases?: number
  strikeOuts?: number
  baseOnBalls?: number
  plateAppearances?: number
  babip?: number
  // Pitching
  era?: number
  whip?: number
  wins?: number
  losses?: number
  saves?: number
  holds?: number
  blownSaves?: number
  inningsPitched?: number | string
  strikeOutsPitched?: number
  baseOnBallsPitched?: number
  homeRunsPitched?: number
  qualityStarts?: number
  games?: number
  gamesStarted?: number
  battersFaced?: number   // for pitcher K% / K-BB%
}

// Statcast / Baseball Savant data (fetched separately)
export interface StatcastData {
  // Shared
  xwoba?: number
  woba?: number
  // Batting
  hard_hit_percent?: number
  barrel_batted_rate?: number
  // Pitching
  xera?: number
  // Calculated fields we add
  wrc_plus?: number       // estimated from wOBA
  fip?: number            // calculated from K/BB/HR/IP
  k_percent?: number      // K / PA (batters) or K / BF (pitchers)
  bb_percent?: number
  k_minus_bb?: number     // K% - BB%
}

export interface MlbPlayerDetail {
  id: number
  fullName: string
  firstName: string
  lastName: string
  primaryNumber: string
  birthDate: string
  currentAge: number
  birthCity: string
  birthStateProvince: string
  birthCountry: string
  height: string
  weight: number
  active: boolean
  primaryPosition: { name: string; abbreviation: string }
  useName: string
  mlbDebutDate: string
  batSide: { description: string }
  pitchHand: { description: string }
  currentTeam: { id: number; name: string }
  draftYear?: number
}

export async function fetchPlayerDetail(mlbId: number): Promise<MlbPlayerDetail | null> {
  try {
    const res = await fetch(`${MLB_API}/people/${mlbId}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const json = await res.json()
    return json.people?.[0] ?? null
  } catch { return null }
}

export async function fetchPlayerStats(mlbId: number): Promise<{
  batting: MlbStatLine[]
  pitching: MlbStatLine[]
  careerBatting: MlbStatLine | null
  careerPitching: MlbStatLine | null
}> {
  try {
    const res = await fetch(
      `${MLB_API}/people/${mlbId}/stats?stats=yearByYear,career&group=hitting,pitching&sportId=1`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return { batting: [], pitching: [], careerBatting: null, careerPitching: null }
    const json = await res.json()

    const batting: MlbStatLine[] = []
    const pitching: MlbStatLine[] = []
    let careerBatting: MlbStatLine | null = null
    let careerPitching: MlbStatLine | null = null

    for (const group of json.stats ?? []) {
      const isHitting = group.group?.displayName === 'hitting'
      const isPitching = group.group?.displayName === 'pitching'
      const isCareer = group.type?.displayName === 'career'

      for (const split of group.splits ?? []) {
        const s = split.stat
        const line: MlbStatLine = {
          season: split.season ?? 'Career',
          team: split.team?.name ?? '—',
          teamId: split.team?.id ?? 0,
          avg: s.avg, obp: s.obp, slg: s.slg, ops: s.ops,
          ab: s.atBats, hits: s.hits, doubles: s.doubles, triples: s.triples,
          homeRuns: s.homeRuns, rbi: s.rbi, runs: s.runs,
          stolenBases: s.stolenBases, strikeOuts: s.strikeOuts,
          baseOnBalls: s.baseOnBalls, plateAppearances: s.plateAppearances,
          babip: s.babip,
          era: s.era, whip: s.whip, wins: s.wins, losses: s.losses,
          saves: s.saves, holds: s.holds, blownSaves: s.blownSaves,
          inningsPitched: s.inningsPitched, strikeOutsPitched: s.strikeOuts,
          baseOnBallsPitched: s.baseOnBalls, homeRunsPitched: s.homeRuns,
          qualityStarts: s.qualityStarts,
          games: s.gamesPitched ?? s.gamesPlayed,
          gamesStarted: s.gamesStarted,
          battersFaced: s.battersFaced,
        }
        if (isHitting && isCareer) careerBatting = line
        else if (isPitching && isCareer) careerPitching = line
        else if (isHitting) batting.push(line)
        else if (isPitching) pitching.push(line)
      }
    }

    // Sort by season descending
    batting.sort((a, b) => Number(b.season) - Number(a.season))
    pitching.sort((a, b) => Number(b.season) - Number(a.season))

    return { batting, pitching, careerBatting, careerPitching }
  } catch {
    return { batting: [], pitching: [], careerBatting: null, careerPitching: null }
  }
}

// ─── Statcast / Baseball Savant ─────────────────────────────────────────────

// Baseball Savant expected_statistics endpoint.
// Returns null gracefully if Savant is unreachable — percentile bars just hide those rows.
export async function fetchStatcastData(
  mlbId: number,
  isPitcher: boolean,
  season = new Date().getFullYear()
): Promise<StatcastData | null> {
  try {
    const type = isPitcher ? 'pitcher' : 'batter'
    const res = await fetch(
      `https://baseballsavant.mlb.com/expected_statistics?type=${type}&year=${season}&position=&team=&min=1&csv=false`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const json = await res.json()

    // Savant returns an array; find our player by mlb_id / player_id
    const row = (json ?? []).find(
      (p: any) => p.player_id === mlbId || p.mlb_id === mlbId
    )
    if (!row) return null

    return {
      xwoba: row.est_woba != null ? Number(row.est_woba) : undefined,
      woba: row.woba != null ? Number(row.woba) : undefined,
      hard_hit_percent: row.hard_hit_percent != null ? Number(row.hard_hit_percent) : undefined,
      barrel_batted_rate: row.barrel_batted_rate != null ? Number(row.barrel_batted_rate) : undefined,
      xera: row.xera != null ? Number(row.xera) : undefined,
    }
  } catch {
    return null
  }
}

// ─── Derived / calculated advanced stats ────────────────────────────────────

// Approximate wRC+ from a stat line using wOBA estimation.
// wOBA weights (2024 approximate): BB=0.69, 1B=0.89, 2B=1.27, 3B=1.62, HR=2.10
// League wOBA ≈ 0.318, wOBA scale ≈ 1.22
export function calcWrcPlus(stat: MlbStatLine): number | null {
  const { ab, hits, doubles, triples, homeRuns, baseOnBalls, plateAppearances } = stat
  if (!ab || !hits || !plateAppearances || !plateAppearances) return null
  const singles = (hits - (doubles ?? 0) - (triples ?? 0) - (homeRuns ?? 0))
  const woba =
    (0.69 * (baseOnBalls ?? 0) +
      0.89 * singles +
      1.27 * (doubles ?? 0) +
      1.62 * (triples ?? 0) +
      2.10 * (homeRuns ?? 0)) /
    plateAppearances
  const LEAGUE_WOBA = 0.318
  const WOBA_SCALE = 1.22
  return Math.round(((woba - LEAGUE_WOBA) / WOBA_SCALE) * 100 + 100)
}

// FIP = ((13*HR + 3*(BB) - 2*K) / IP) + FIP_constant
// FIP constant ≈ 3.15 (brings league FIP in line with ERA)
export function calcFip(stat: MlbStatLine): number | null {
  const ip = Number(stat.inningsPitched)
  const { strikeOutsPitched: k, baseOnBallsPitched: bb, homeRunsPitched: hr } = stat
  if (!ip || !k || bb === undefined || !hr) return null
  const FIP_CONSTANT = 3.15
  return ((13 * hr + 3 * bb - 2 * k) / ip) + FIP_CONSTANT
}

// K% for batters: K / PA
export function calcBatterKPct(stat: MlbStatLine): number | null {
  if (!stat.strikeOuts || !stat.plateAppearances) return null
  return stat.strikeOuts / stat.plateAppearances
}

// K% for pitchers: K / BF (batters faced)
export function calcPitcherKPct(stat: MlbStatLine): number | null {
  const bf = stat.battersFaced
  if (!stat.strikeOutsPitched || !bf) return null
  return stat.strikeOutsPitched / bf
}

// BB% for pitchers: BB / BF
export function calcPitcherBBPct(stat: MlbStatLine): number | null {
  const bf = stat.battersFaced
  if (!stat.baseOnBallsPitched || !bf) return null
  return stat.baseOnBallsPitched / bf
}

// K-BB% for pitchers
export function calcKMinusBB(stat: MlbStatLine): number | null {
  const k = calcPitcherKPct(stat)
  const bb = calcPitcherBBPct(stat)
  if (k === null || bb === null) return null
  return k - bb
}

// ─── Percentile helpers ──────────────────────────────────────────────────────

// Calculate a 0-100 percentile given a value, min, max, and whether higher is better
export function percentile(value: number, min: number, max: number, higherIsBetter = true): number {
  const clamped = Math.min(Math.max(value, min), max)
  const raw = (clamped - min) / (max - min)
  return Math.round(higherIsBetter ? raw * 100 : (1 - raw) * 100)
}

// Percentile color: red (elite) → yellow (avg) → blue (poor)  like Savant
export function percentileColor(pct: number): string {
  if (pct >= 90) return '#e63946'       // red — elite
  if (pct >= 70) return '#f4845f'       // orange
  if (pct >= 45) return '#adb5bd'       // gray — average
  if (pct >= 25) return '#74c0fc'       // light blue
  return '#4dabf7'                       // blue — poor
}
