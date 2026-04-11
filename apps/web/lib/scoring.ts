// ─── Fantasy Points Calculation Engine ────────────────────────────────────────

const MLB_API = 'https://statsapi.mlb.com/api/v1'

export interface ScoringCategory {
  stat_key: string
  label: string
  points_per_unit: number
}

// The raw stat keys we track (maps to scoring_categories.stat_key)
export interface RawGameStats {
  // Batting
  AB?: number
  R?: number
  HR?: number
  RBI?: number
  SB?: number
  BB_b?: number
  H?: number
  '2B'?: number
  '3B'?: number
  SO_b?: number
  CS?: number
  // Pitching
  W?: number
  L?: number
  SV?: number
  BS?: number
  HLD?: number
  K?: number
  IP?: number
  OUTS?: number
  QS?: number
  ER?: number
  BB_p?: number
}

export function calculateFantasyPoints(
  stats: RawGameStats,
  categories: ScoringCategory[]
): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const cat of categories) {
    const val = (stats as Record<string, number | undefined>)[cat.stat_key]
    if (val !== undefined && val !== 0) {
      const pts = val * Number(cat.points_per_unit)
      if (pts !== 0) {
        breakdown[cat.stat_key] = Math.round(pts * 100) / 100
        total += pts
      }
    }
  }

  return { total: Math.round(total * 100) / 100, breakdown }
}

// Parse inningsPitched string like "6.1" (6 innings + 1 out) into a decimal
export function parseIP(raw: string | number | undefined): { ip: number; outs: number } {
  if (raw === undefined || raw === null) return { ip: 0, outs: 0 }
  const s = String(raw)
  const [wholeStr, partStr] = s.split('.')
  const whole = parseInt(wholeStr ?? '0', 10) || 0
  const part = parseInt(partStr ?? '0', 10) || 0
  const totalOuts = whole * 3 + part
  return { ip: Math.round((whole + part / 3) * 100) / 100, outs: totalOuts }
}

export function extractBattingStats(mlbStats: Record<string, any>): RawGameStats {
  return {
    AB: mlbStats.atBats ?? 0,
    R: mlbStats.runs ?? 0,
    HR: mlbStats.homeRuns ?? 0,
    RBI: mlbStats.rbi ?? 0,
    SB: mlbStats.stolenBases ?? 0,
    BB_b: mlbStats.baseOnBalls ?? 0,
    H: Math.max(0, (mlbStats.hits ?? 0) - (mlbStats.doubles ?? 0) - (mlbStats.triples ?? 0) - (mlbStats.homeRuns ?? 0)),
    '2B': mlbStats.doubles ?? 0,
    '3B': mlbStats.triples ?? 0,
    SO_b: mlbStats.strikeOuts ?? 0,
    CS: mlbStats.caughtStealing ?? 0,
  }
}

export function extractPitchingStats(
  mlbStats: Record<string, any>,
  isWin: boolean,
  isLoss: boolean,
  isSave: boolean
): RawGameStats {
  const { ip, outs } = parseIP(mlbStats.inningsPitched)
  const er = mlbStats.earnedRuns ?? 0
  const k = mlbStats.strikeOuts ?? 0
  const bb = mlbStats.baseOnBalls ?? 0
  const qs = ip >= 6 && er <= 3 ? 1 : 0
  const hld = mlbStats.holds ?? mlbStats.hold ?? 0
  const bs = mlbStats.blownSaves ?? mlbStats.blownSave ?? 0

  return {
    W: isWin ? 1 : 0,
    L: isLoss ? 1 : 0,
    SV: isSave ? 1 : 0,
    HLD: hld,
    BS: bs,
    K: k,
    IP: ip,
    OUTS: outs,
    QS: qs,
    ER: er,
    BB_p: bb,
  }
}

// ─── MLB API helpers ──────────────────────────────────────────────────────────

export interface MlbGameSummary {
  gamePk: number
  status: string  // 'Final', 'In Progress', etc.
}

export async function fetchGamesForDate(date: string): Promise<MlbGameSummary[]> {
  try {
    const res = await fetch(`${MLB_API}/schedule?sportId=1&date=${date}`, {
      next: { revalidate: 0 }, // always fresh for scoring
    })
    if (!res.ok) return []
    const json = await res.json()
    const games: MlbGameSummary[] = []
    for (const dateEntry of json.dates ?? []) {
      for (const game of dateEntry.games ?? []) {
        games.push({
          gamePk: game.gamePk,
          status: game.status?.detailedState ?? game.status?.abstractGameState ?? 'Unknown',
        })
      }
    }
    return games
  } catch {
    return []
  }
}

export interface PlayerGameResult {
  mlbId: number
  fullName: string
  batting: RawGameStats | null
  pitching: RawGameStats | null
}

export async function fetchBoxScore(gamePk: number): Promise<PlayerGameResult[]> {
  try {
    const res = await fetch(`${MLB_API}/game/${gamePk}/boxscore`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return []
    const json = await res.json()

    const decisions = json.decisions ?? {}
    const winnerId: number | null = decisions.winner?.id ?? null
    const loserId: number | null = decisions.loser?.id ?? null
    const saveId: number | null = decisions.save?.id ?? null

    const results: PlayerGameResult[] = []

    for (const side of ['home', 'away'] as const) {
      const teamData = json.teams?.[side]
      if (!teamData?.players) continue

      for (const [, playerData] of Object.entries(teamData.players as Record<string, any>)) {
        const mlbId: number = playerData.person?.id
        if (!mlbId) continue
        const fullName: string = playerData.person?.fullName ?? ''
        const bs = playerData.stats?.batting
        const ps = playerData.stats?.pitching

        const hasBatted =
          bs &&
          (bs.atBats > 0 || bs.baseOnBalls > 0 || bs.hitByPitch > 0 || bs.sacrificeBunts > 0)
        const hasPitched = ps && (ps.inningsPitched !== '0.0' && ps.inningsPitched !== '0')

        results.push({
          mlbId,
          fullName,
          batting: hasBatted ? extractBattingStats(bs) : null,
          pitching: hasPitched
            ? extractPitchingStats(ps, mlbId === winnerId, mlbId === loserId, mlbId === saveId)
            : null,
        })
      }
    }

    return results
  } catch {
    return []
  }
}

// ─── Active slot check ────────────────────────────────────────────────────────
// Players on BENCH, TAXI, or IL do NOT contribute to team score

export function isActiveSlot(slotType: string): boolean {
  return !['BENCH', 'TAXI', 'IL', 'NA'].includes(slotType)
}

// ─── Position → eligible roster slots ─────────────────────────────────────────

export const POSITION_ELIGIBLE_SLOTS: Record<string, string[]> = {
  C:    ['C',  'IF',   'UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  '1B': ['1B', 'IF',   'UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  '2B': ['2B', 'IF',   'UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  '3B': ['3B', 'IF',   'UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  SS:   ['SS', 'IF',   'UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  OF:   ['OF', 'UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  DH:   ['UTIL', 'BENCH', 'IL', 'TAXI', 'NA'],
  SP:   ['SP', 'P',   'BENCH', 'IL', 'TAXI', 'NA'],
  RP:   ['RP', 'P',   'BENCH', 'IL', 'TAXI', 'NA'],
}

export function getEligibleSlots(
  position: string,
  leagueSettings: {
    spots_if: number
    spots_util: number
    spots_p: number
    spots_taxi?: number
  },
  playerInfo?: {
    status?: string      // 'active' | 'injured' | 'minors' | 'inactive'
    isRookie?: boolean   // true = current-year MLB rookie
    isSecondYear?: boolean  // true = exceeded rookie limits last season
  }
): string[] {
  const base = POSITION_ELIGIBLE_SLOTS[position] ?? ['BENCH', 'IL', 'TAXI', 'NA']
  return base.filter(slot => {
    if (slot === 'IF'   && leagueSettings.spots_if === 0) return false
    if (slot === 'UTIL' && leagueSettings.spots_util === 0) return false
    if (slot === 'P'    && leagueSettings.spots_p === 0) return false
    if (slot === 'TAXI' && !leagueSettings.spots_taxi) return false
    // NA only available for players currently in the minors
    if (slot === 'NA'   && playerInfo?.status !== 'minors') return false
    // TAXI only available for rookies and second-year players
    if (slot === 'TAXI' && !playerInfo?.isRookie && !playerInfo?.isSecondYear) return false
    return true
  })
}

// ─── Round-robin schedule generation ─────────────────────────────────────────

// Returns an array of rounds, each round is an array of [homeTeamId, awayTeamId] pairs
export function generateRoundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  const teams = [...teamIds]
  if (teams.length % 2 === 1) teams.push('BYE')
  const n = teams.length
  const half = n / 2

  const fixed = teams[0]
  const rotating = teams.slice(1)
  const rounds: Array<Array<[string, string]>> = []

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = []

    const opponent = rotating[r % (n - 1)]
    if (opponent !== 'BYE') pairs.push([fixed, opponent])

    for (let i = 1; i < half; i++) {
      const home = rotating[(r + i) % (n - 1)]
      const away = rotating[(r + n - 1 - i) % (n - 1)]
      if (home !== 'BYE' && away !== 'BYE') pairs.push([home, away])
    }
    rounds.push(pairs)
  }

  return rounds
}
