'use client'

import {
  MlbStatLine,
  StatcastData,
  percentile,
  percentileColor,
  calcWrcPlus,
  calcFip,
  calcBatterKPct,
  calcPitcherKPct,
  calcPitcherBBPct,
  calcKMinusBB,
} from '@/lib/mlb'

interface Props {
  isPitcher: boolean
  batting: MlbStatLine | null
  pitching: MlbStatLine | null
  statcast: StatcastData | null
}

interface StatDef {
  label: string
  sublabel?: string          // shown under the value, e.g. "Statcast"
  value: number | undefined | null
  min: number
  max: number
  higherIsBetter: boolean
  format: (v: number) => string
  source?: 'savant'          // shows a Savant badge if from Baseball Savant
}

function PercentileBar({ label, sublabel, value, pct, source }: {
  label: string
  sublabel?: string
  value: string
  pct: number
  source?: 'savant'
}) {
  const color = percentileColor(pct)
  return (
    <div className="flex items-center gap-3">
      {/* Percentile bubble */}
      <div
        className="w-10 h-7 flex items-center justify-center text-sm font-bold rounded flex-shrink-0"
        style={{ backgroundColor: color, color: pct >= 45 ? '#fff' : '#0d1117' }}
      >
        {pct}
      </div>

      {/* Bar track */}
      <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color, transition: 'width 0.6s ease' }}
        />
        {/* 50th pct marker */}
        <div className="absolute top-0 bottom-0 w-px bg-gray-600" style={{ left: '50%' }} />
      </div>

      {/* Stat name + value */}
      <div className="w-44 flex justify-between items-baseline flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-200">{label}</span>
          {source === 'savant' && (
            <span className="text-xs px-1 py-0 rounded bg-gray-700 text-gray-400 leading-tight">
              SC
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-sm font-mono text-gray-300">{value}</span>
          {sublabel && <p className="text-xs text-gray-500 leading-none">{sublabel}</p>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{title}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

export function PercentileBars({ isPitcher, batting, pitching, statcast }: Props) {
  function fmt(v: number | undefined | null, decimals = 3, prefix = ''): string {
    if (v == null) return '—'
    const n = Number(v)
    if (isNaN(n)) return '—'
    const s = decimals === 0 ? n.toFixed(0) : n.toFixed(decimals)
    return prefix + (decimals >= 3 ? s.replace(/^0\./, '.') : s)
  }

  // ── Batting stat defs ──────────────────────────────────────────────────────
  const battingDefs: { section: string; stats: StatDef[] }[] = [
    {
      section: 'Plate Discipline',
      stats: [
        {
          label: 'K%',
          value: batting ? calcBatterKPct(batting) : undefined,
          min: 0.10, max: 0.35, higherIsBetter: false,
          format: v => `${(v * 100).toFixed(1)}%`,
        },
        {
          label: 'BB%',
          value: batting?.baseOnBalls && batting?.plateAppearances
            ? batting.baseOnBalls / batting.plateAppearances : undefined,
          min: 0.04, max: 0.18, higherIsBetter: true,
          format: v => `${(v * 100).toFixed(1)}%`,
        },
      ],
    },
    {
      section: 'Hitting Quality',
      stats: [
        {
          label: 'wRC+',
          sublabel: 'estimated',
          value: batting ? calcWrcPlus(batting) : undefined,
          min: 60, max: 180, higherIsBetter: true,
          format: v => v.toFixed(0),
        },
        {
          label: 'xwOBA',
          sublabel: 'Statcast',
          value: statcast?.xwoba,
          min: 0.260, max: 0.430, higherIsBetter: true,
          format: v => fmt(v),
          source: 'savant',
        },
        {
          label: 'Hard Hit%',
          sublabel: 'Statcast',
          value: statcast?.hard_hit_percent,
          min: 25, max: 60, higherIsBetter: true,
          format: v => `${v.toFixed(1)}%`,
          source: 'savant',
        },
        {
          label: 'Barrel%',
          sublabel: 'Statcast',
          value: statcast?.barrel_batted_rate,
          min: 2, max: 20, higherIsBetter: true,
          format: v => `${v.toFixed(1)}%`,
          source: 'savant',
        },
      ],
    },
    {
      section: 'Rate Stats',
      stats: [
        {
          label: 'AVG',
          value: batting?.avg,
          min: 0.190, max: 0.330, higherIsBetter: true,
          format: v => fmt(v),
        },
        {
          label: 'OBP',
          value: batting?.obp,
          min: 0.270, max: 0.420, higherIsBetter: true,
          format: v => fmt(v),
        },
        {
          label: 'SLG',
          value: batting?.slg,
          min: 0.300, max: 0.600, higherIsBetter: true,
          format: v => fmt(v),
        },
        {
          label: 'OPS',
          value: batting?.ops,
          min: 0.570, max: 1.020, higherIsBetter: true,
          format: v => fmt(v),
        },
      ],
    },
    {
      section: 'Counting Stats (per 600 PA)',
      stats: [
        {
          label: 'HR',
          value: batting?.homeRuns && batting?.plateAppearances
            ? (batting.homeRuns / batting.plateAppearances) * 600 : undefined,
          min: 0, max: 50, higherIsBetter: true,
          format: v => v.toFixed(1),
        },
        {
          label: 'SB',
          value: batting?.stolenBases && batting?.plateAppearances
            ? (batting.stolenBases / batting.plateAppearances) * 600 : undefined,
          min: 0, max: 60, higherIsBetter: true,
          format: v => v.toFixed(1),
        },
      ],
    },
  ]

  // ── Pitching stat defs ─────────────────────────────────────────────────────
  const pitchingDefs: { section: string; stats: StatDef[] }[] = [
    {
      section: 'Stuff & Command',
      stats: [
        {
          label: 'K%',
          value: pitching ? calcPitcherKPct(pitching) : undefined,
          min: 0.12, max: 0.38, higherIsBetter: true,
          format: v => `${(v * 100).toFixed(1)}%`,
        },
        {
          label: 'BB%',
          value: pitching ? calcPitcherBBPct(pitching) : undefined,
          min: 0.04, max: 0.16, higherIsBetter: false,
          format: v => `${(v * 100).toFixed(1)}%`,
        },
        {
          label: 'K-BB%',
          value: pitching ? calcKMinusBB(pitching) : undefined,
          min: -0.02, max: 0.30, higherIsBetter: true,
          format: v => `${(v * 100).toFixed(1)}%`,
        },
        {
          label: 'K/9',
          value: pitching?.strikeOutsPitched && pitching?.inningsPitched
            ? (Number(pitching.strikeOutsPitched) / Number(pitching.inningsPitched)) * 9 : undefined,
          min: 5.0, max: 14.5, higherIsBetter: true,
          format: v => v.toFixed(1),
        },
      ],
    },
    {
      section: 'Run Prevention',
      stats: [
        {
          label: 'ERA',
          value: pitching?.era,
          min: 1.80, max: 5.80, higherIsBetter: false,
          format: v => v.toFixed(2),
        },
        {
          label: 'FIP',
          sublabel: 'calculated',
          value: pitching ? calcFip(pitching) : undefined,
          min: 2.00, max: 5.50, higherIsBetter: false,
          format: v => v.toFixed(2),
        },
        {
          label: 'xERA',
          sublabel: 'Statcast',
          value: statcast?.xera,
          min: 2.00, max: 5.50, higherIsBetter: false,
          format: v => v.toFixed(2),
          source: 'savant',
        },
        {
          label: 'WHIP',
          value: pitching?.whip,
          min: 0.85, max: 1.75, higherIsBetter: false,
          format: v => v.toFixed(2),
        },
      ],
    },
    {
      section: 'Contact Quality Allowed',
      stats: [
        {
          label: 'xwOBA against',
          sublabel: 'Statcast',
          value: statcast?.xwoba,
          min: 0.250, max: 0.420, higherIsBetter: false,
          format: v => fmt(v),
          source: 'savant',
        },
        {
          label: 'Hard Hit% against',
          sublabel: 'Statcast',
          value: statcast?.hard_hit_percent,
          min: 25, max: 55, higherIsBetter: false,
          format: v => `${v.toFixed(1)}%`,
          source: 'savant',
        },
        {
          label: 'HR/9',
          value: pitching?.homeRunsPitched && pitching?.inningsPitched
            ? (Number(pitching.homeRunsPitched) / Number(pitching.inningsPitched)) * 9 : undefined,
          min: 0.4, max: 2.2, higherIsBetter: false,
          format: v => v.toFixed(2),
        },
      ],
    },
  ]

  const defs = isPitcher ? pitchingDefs : battingDefs
  const hasAnyData = defs.some(s => s.stats.some(st => st.value != null))

  if (!hasAnyData) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
        No current season data available yet.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: '#e63946' }} />
          <span>Elite (90th+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: '#adb5bd' }} />
          <span>Average (45–69th)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: '#4dabf7' }} />
          <span>Below avg (&lt;25th)</span>
        </div>
        <span className="ml-auto">
          <span className="px-1 py-0 rounded bg-gray-700 text-gray-400 text-xs mr-1">SC</span>
          = Statcast (Baseball Savant)
        </span>
      </div>

      {defs.map(section => {
        const validStats = section.stats.filter(s => s.value != null)
        if (validStats.length === 0) return null
        return (
          <Section key={section.section} title={section.section}>
            {validStats.map(s => {
              const n = Number(s.value!)
              return (
                <PercentileBar
                  key={s.label}
                  label={s.label}
                  sublabel={s.sublabel}
                  value={isNaN(n) ? '—' : s.format(n)}
                  pct={isNaN(n) ? 50 : percentile(n, s.min, s.max, s.higherIsBetter)}
                  source={s.source}
                />
              )
            })}
          </Section>
        )
      })}

      <p className="text-xs text-gray-600 border-t border-gray-800 pt-3">
        wRC+ is estimated from play-by-play weights. FIP uses a 3.15 constant.
        Statcast stats (SC) sourced from Baseball Savant — may be unavailable mid-season or for players with limited PA/BF.
      </p>
    </div>
  )
}
