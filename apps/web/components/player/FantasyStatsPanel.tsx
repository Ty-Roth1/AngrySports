'use client'

interface GameScore {
  fantasy_points: number
  raw_stats: Record<string, number> | null
  mlb_game_id: number
  game_date: string
}

interface DayStats {
  date: string
  fantasy_points: number
  batting: Record<string, number> | null
  pitching: Record<string, number> | null
}

function mergeStats(
  a: Record<string, number> | null,
  b: Record<string, number>
): Record<string, number> {
  if (!a) return { ...b }
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}

function groupByDate(scores: GameScore[]): DayStats[] {
  const byDate: Record<string, DayStats> = {}
  // Track seen mlb_game_ids per date to avoid double-counting the same game
  // across multiple matchup rows (can happen when data was written to multiple matchups)
  const seenGames = new Set<string>()

  for (const s of scores) {
    const gameKey = `${s.game_date}:${s.mlb_game_id}`
    if (seenGames.has(gameKey)) continue
    seenGames.add(gameKey)

    if (!byDate[s.game_date])
      byDate[s.game_date] = { date: s.game_date, fantasy_points: 0, batting: null, pitching: null }
    byDate[s.game_date].fantasy_points += Number(s.fantasy_points)
    if (!s.raw_stats) continue
    if (s.mlb_game_id < 0)
      byDate[s.game_date].pitching = mergeStats(byDate[s.game_date].pitching, s.raw_stats)
    else
      byDate[s.game_date].batting = mergeStats(byDate[s.game_date].batting, s.raw_stats)
  }
  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date))
}

function sumStats(days: DayStats[], key: 'batting' | 'pitching'): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of days) {
    const src = d[key]
    if (!src) continue
    for (const [k, v] of Object.entries(src)) out[k] = (out[k] ?? 0) + v
  }
  return out
}

function formatStatline(b: Record<string, number> | null, p: Record<string, number> | null): string {
  if (b) {
    const parts: string[] = []
    const singles = b.H ?? 0
    const doubles = b['2B'] ?? 0
    const triples = b['3B'] ?? 0
    const hrs     = b.HR ?? 0
    const totalH  = singles + doubles + triples + hrs
    const ab      = b.AB ?? 0
    if (ab > 0)        parts.push(`${totalH}/${ab}`)
    else if (totalH > 0) parts.push(`${totalH}H`)
    if (singles > 0) parts.push(singles === 1 ? '1B'  : `${singles} 1B`)
    if (doubles > 0) parts.push(doubles === 1 ? '2B'  : `${doubles} 2B`)
    if (triples > 0) parts.push(triples === 1 ? '3B'  : `${triples} 3B`)
    if (hrs     > 0) parts.push(hrs     === 1 ? 'HR'  : `${hrs} HR`)
    if ((b.R   ?? 0) > 0) parts.push(b.R   === 1 ? 'R'   : `${b.R} R`)
    if ((b.RBI ?? 0) > 0) parts.push(b.RBI === 1 ? 'RBI' : `${b.RBI} RBI`)
    if ((b.SB  ?? 0) > 0) parts.push(b.SB  === 1 ? 'SB'  : `${b.SB} SB`)
    if ((b.BB_b ?? 0) > 0) parts.push(b.BB_b === 1 ? 'BB' : `${b.BB_b} BB`)
    if ((b.SO_b ?? 0) > 0) parts.push(b.SO_b === 1 ? 'K'  : `${b.SO_b} K`)
    return parts.join(', ') || '—'
  }
  if (p) {
    const parts: string[] = []
    if ((p.W   ?? 0) > 0) parts.push('W')
    if ((p.SV  ?? 0) > 0) parts.push('SV')
    if ((p.HLD ?? 0) > 0) parts.push('HLD')
    if ((p.IP  ?? 0) > 0) parts.push(`${p.IP} IP`)
    if ((p.K   ?? 0) > 0) parts.push(`${p.K} K`)
    if (p.ER   !== undefined) parts.push(`${p.ER} ER`)
    if ((p.BB_p ?? 0) > 0) parts.push(`${p.BB_p} BB`)
    return parts.join(', ') || '—'
  }
  return '—'
}

function formatDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function fmtPts(pts: number): string {
  return pts > 0 ? `+${pts.toFixed(1)}` : pts.toFixed(1)
}

export function FantasyStatsPanel({
  scores,
  isPitcher,
  today,
}: {
  scores: GameScore[]
  isPitcher: boolean
  today: string
}) {
  const days      = groupByDate(scores)
  const todayStats = days.find(d => d.date === today)
  const recent5   = days.slice(0, 5)
  const totalPts  = days.reduce((s, d) => s + d.fantasy_points, 0)

  const seasonBat   = sumStats(days, 'batting')
  const seasonPitch = sumStats(days, 'pitching')

  const totalH = (seasonBat.H ?? 0) + (seasonBat['2B'] ?? 0) + (seasonBat['3B'] ?? 0) + (seasonBat.HR ?? 0)
  const avg    = seasonBat.AB ? totalH / seasonBat.AB : 0
  const era    = seasonPitch.IP ? (seasonPitch.ER ?? 0) / seasonPitch.IP * 9 : 0

  const hasSeasonBat   = (seasonBat.AB ?? 0) > 0
  const hasSeasonPitch = (seasonPitch.OUTS ?? 0) > 0

  return (
    <div className="space-y-4">

      {/* Today's statline */}
      {todayStats && (
        <div className="bg-gray-900 border border-red-800/50 rounded-xl px-5 py-4">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-2">Today</p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-200">
              {formatStatline(todayStats.batting, todayStats.pitching)}
            </p>
            <p className="text-lg font-bold text-white whitespace-nowrap">
              {fmtPts(todayStats.fantasy_points)} pts
            </p>
          </div>
        </div>
      )}

      {/* Season totals */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Season Fantasy Stats</p>
            <p className="text-xs text-gray-600 mt-0.5">{days.length} game{days.length !== 1 ? 's' : ''}</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {totalPts.toFixed(1)}
            <span className="text-sm font-normal text-gray-400 ml-1">pts</span>
          </p>
        </div>

        {!isPitcher && hasSeasonBat && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center">
            {[
              { label: 'AVG', value: avg.toFixed(3).replace('0.', '.') },
              { label: 'H',   value: totalH },
              { label: 'HR',  value: seasonBat.HR  ?? 0 },
              { label: 'R',   value: seasonBat.R   ?? 0 },
              { label: 'RBI', value: seasonBat.RBI ?? 0 },
              { label: 'SB',  value: seasonBat.SB  ?? 0 },
              { label: 'BB',  value: seasonBat.BB_b ?? 0 },
              { label: 'SO',  value: seasonBat.SO_b ?? 0 },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-sm font-semibold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {isPitcher && hasSeasonPitch && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
            {[
              { label: 'ERA', value: era.toFixed(2) },
              { label: 'IP',  value: seasonPitch.IP?.toFixed(1) ?? '0.0' },
              { label: 'W',   value: seasonPitch.W  ?? 0 },
              { label: 'SV',  value: seasonPitch.SV ?? 0 },
              { label: 'K',   value: seasonPitch.K  ?? 0 },
              { label: 'BB',  value: seasonPitch.BB_p ?? 0 },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-sm font-semibold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {!hasSeasonBat && !hasSeasonPitch && (
          <p className="text-sm text-gray-600 text-center py-2">No stats yet this season.</p>
        )}
      </div>

      {/* Last 5 games */}
      {recent5.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
              Last {recent5.length} Game{recent5.length !== 1 ? 's' : ''}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-5 py-2">Date</th>
                <th className="text-left px-5 py-2">Stats</th>
                <th className="text-right px-5 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {recent5.map(d => (
                <tr key={d.date} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                  <td className="px-5 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(d.date)}</td>
                  <td className="px-5 py-2.5 text-gray-300 text-xs">{formatStatline(d.batting, d.pitching)}</td>
                  <td className="px-5 py-2.5 text-right font-medium text-white">{fmtPts(d.fantasy_points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {days.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-8 text-center text-gray-500 text-sm">
          No fantasy stats recorded yet this season.
        </div>
      )}
    </div>
  )
}
