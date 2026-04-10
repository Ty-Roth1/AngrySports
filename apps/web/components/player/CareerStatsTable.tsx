import { MlbStatLine } from '@/lib/mlb'

function fmt(val: number | string | undefined | null, decimals = 3): string {
  if (val === undefined || val === null) return '—'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return decimals === 0 ? n.toFixed(0) : n.toFixed(decimals).replace(/^0\./, '.')
}

function BattingTable({ rows }: { rows: MlbStatLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-white">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
            {['Year', 'Team', 'AVG', 'OBP', 'SLG', 'OPS', 'PA', 'AB', 'H', '2B', '3B', 'HR', 'RBI', 'R', 'SB', 'BB', 'SO'].map(h => (
              <th key={h} className={`py-2 px-3 font-semibold ${h === 'Year' || h === 'Team' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
              <td className="py-2 px-3 font-semibold text-white">{row.season}</td>
              <td className="py-2 px-3 text-gray-300">{row.team}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-200">{fmt(row.avg)}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-200">{fmt(row.obp)}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-200">{fmt(row.slg)}</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{fmt(row.ops)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.plateAppearances, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.ab, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.hits, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.doubles, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.triples, 0)}</td>
              <td className="py-2 px-3 text-right font-bold text-white">{fmt(row.homeRuns, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.rbi, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.runs, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.stolenBases, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.baseOnBalls, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-400">{fmt(row.strikeOuts, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PitchingTable({ rows }: { rows: MlbStatLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-white">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-700">
            {['Year', 'Team', 'W', 'L', 'ERA', 'WHIP', 'G', 'GS', 'IP', 'K', 'BB', 'HR', 'SV', 'HLD', 'QS'].map(h => (
              <th key={h} className={`py-2 px-3 font-semibold ${h === 'Year' || h === 'Team' ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
              <td className="py-2 px-3 font-semibold text-white">{row.season}</td>
              <td className="py-2 px-3 text-gray-300">{row.team}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.wins, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.losses, 0)}</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{fmt(row.era)}</td>
              <td className="py-2 px-3 text-right font-mono font-bold text-white">{fmt(row.whip)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.games, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.gamesStarted, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{row.inningsPitched ?? '—'}</td>
              <td className="py-2 px-3 text-right font-bold text-white">{fmt(row.strikeOutsPitched, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.baseOnBallsPitched, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-400">{fmt(row.homeRunsPitched, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.saves, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.holds, 0)}</td>
              <td className="py-2 px-3 text-right text-gray-300">{fmt(row.qualityStarts, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CareerStatsTable({ batting, pitching, isPitcher }: {
  batting: MlbStatLine[]
  pitching: MlbStatLine[]
  isPitcher: boolean
}) {
  const rows = isPitcher ? pitching : batting

  if (rows.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
        No career stats available.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {isPitcher ? <PitchingTable rows={rows} /> : <BattingTable rows={rows} />}
    </div>
  )
}
